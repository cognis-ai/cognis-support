// The agent-bot loop — ported from
// cognis-platform/apps/bridge/src/features/agent-bot/agent-bot.service.ts
// Change vs Bridge: LLM call goes to the Cognis Brain gateway (per-org key) instead of
// LiteLLM; tenant resolution is the local JSON store instead of Prisma; audit is local.

import type { Config } from './config.js';
import type { TenantStore } from './store/tenant-store.js';
import type { ChatwootConversationClient } from './chatwoot/conversation-client.js';
import type { BrainClient, ChatMessage, BrainError } from './brain/brain-client.js';
import { COGNIS_SUPPORT_PROMPT_V1, COGNIS_SUPPORT_PROMPT_VERSION } from './prompts/cognis-support.v1.js';
import { isIncomingFromCustomer, type ChatwootWebhook } from './chatwoot/dto.js';

const ESCALATE_TAG = '[ESCALATE_TO_HUMAN]';

export interface AuditSink {
  record(event: {
    cognisOrgId: string;
    action: string;
    target: string;
    metadata: Record<string, unknown>;
  }): void;
}

// RAG grounding (V2). Returns a per-tenant knowledge-base context block for a question,
// or null when the KB has nothing relevant (then the bot falls back to "I don't have that
// fact" / escalation per the system prompt). Optional — omit for the pure V0/V1 loop.
export interface Retriever {
  contextFor(orgId: string, brainApiKey: string, query: string): Promise<string | null>;
}

export class AgentBotService {
  constructor(
    private readonly config: Config,
    private readonly tenants: TenantStore,
    private readonly conversation: ChatwootConversationClient,
    private readonly brain: BrainClient,
    private readonly audit: AuditSink,
    private readonly log: (msg: string) => void = console.log,
    private readonly retriever?: Retriever,
  ) {}

  async handleWebhook(payload: ChatwootWebhook): Promise<void> {
    // Only act on inbound customer messages. Lifecycle/bot events are no-ops.
    if (payload.event !== 'message_created') return;
    if (!isIncomingFromCustomer(payload.message_type, payload.private)) return;
    if (!payload.account) return;

    const accountId = payload.account.id;
    const conversationId = payload.conversation?.id;
    if (!conversationId) {
      this.log(`message_created without conversation.id (account=${accountId})`);
      return;
    }

    // Resolve tenant — account_id -> org + tokens + per-org Brain key.
    const tenant = this.tenants.resolveByAccountId(accountId);
    if (!tenant) {
      this.log(`no provisioned tenant for chatwoot account=${accountId}; ignoring`);
      return;
    }
    const { cognisOrgId, adminUserToken, agentBotToken, brainApiKey } = tenant;

    // Bot tokens can post replies but cannot GET messages (a user-tier route) — read with the admin token.
    const history = await this.conversation.getRecentMessages(
      accountId,
      conversationId,
      adminUserToken,
      this.config.maxHistoryMessages,
    );

    // RAG grounding (V2): retrieve the org's KB context for the latest customer question.
    let systemContent = COGNIS_SUPPORT_PROMPT_V1;
    let grounded = false;
    if (this.retriever) {
      const lastUser = [...history.messages].reverse().find((m) => m.role === 'user');
      const query = lastUser?.content ?? payload.content ?? '';
      if (query) {
        try {
          const context = await this.retriever.contextFor(cognisOrgId, brainApiKey, query);
          if (context) {
            grounded = true;
            systemContent =
              `${COGNIS_SUPPORT_PROMPT_V1}\n\n` +
              `Knowledge base for this business — use ONLY this for product/policy facts. ` +
              `If it does not contain the answer, say you don't have that information and offer a human. ` +
              `Do not invent facts beyond it.\n${context}`;
          }
        } catch (err) {
          this.log(`RAG retrieve failed for org=${cognisOrgId}: ${(err as Error).message}`);
        }
      }
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...history.messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    ];

    let replyContent: string;
    try {
      replyContent = await this.brain.complete(brainApiKey, messages, {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        user: cognisOrgId,
      });
    } catch (err) {
      const status = (err as BrainError).status;
      // Gateway "won't answer" contract: 400 injection blocked, 402 quota, 403 tier.
      // Hand to a human gracefully rather than going silent.
      if (status === 400 || status === 402 || status === 403) {
        this.log(`Brain refused (status=${status}) for org=${cognisOrgId}; handing to a human`);
        await this.conversation.postReply(
          accountId, conversationId, agentBotToken,
          'Let me bring in a teammate to help with this.',
        );
        await this.conversation.toggleStatus(accountId, conversationId, agentBotToken, 'open');
        this.audit.record({
          cognisOrgId,
          action: 'agent_bot_handoff',
          target: `conversation:${conversationId}`,
          metadata: { reason: `brain_${status}`, grounded },
        });
        return;
      }
      this.log(`Brain call failed for org=${cognisOrgId}: ${(err as Error).message}`);
      return; // transient/5xx — better silence than a bad reply
    }
    if (!replyContent) return;

    const escalating = replyContent.includes(ESCALATE_TAG);
    const cleanReply = replyContent.replace(ESCALATE_TAG, '').trim();

    if (cleanReply) {
      await this.conversation.postReply(accountId, conversationId, agentBotToken, cleanReply);
    }
    if (escalating) {
      await this.conversation.toggleStatus(accountId, conversationId, agentBotToken, 'open');
      this.log(`escalated conversation ${conversationId} for org=${cognisOrgId}`);
    }

    this.audit.record({
      cognisOrgId,
      action: 'agent_bot_replied',
      target: `conversation:${conversationId}`,
      metadata: {
        prompt_version: COGNIS_SUPPORT_PROMPT_VERSION,
        model: this.config.brainModel,
        escalated: escalating,
        grounded,
      },
    });
  }
}
