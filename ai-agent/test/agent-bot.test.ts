import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentBotService, type AuditSink } from '../src/agent-bot.service.js';
import type { Config } from '../src/config.js';
import type { TenantStore, Tenant } from '../src/store/tenant-store.js';
import type { ChatwootConversationClient } from '../src/chatwoot/conversation-client.js';
import type { BrainClient } from '../src/brain/brain-client.js';
import type { ChatwootWebhook } from '../src/chatwoot/dto.js';

const config = {
  brainModel: 'cognis-brain-default',
  maxHistoryMessages: 12,
  temperature: 0.3,
  maxTokens: 600,
} as Config;

const tenant: Tenant = {
  chatwootAccountId: 1,
  cognisOrgId: 'org_demo',
  adminUserToken: 'admin-tok',
  agentBotToken: 'bot-tok',
  brainApiKey: 'cbk_live_test',
};

function makeService(brainReply: string, retriever?: { contextFor: ReturnType<typeof vi.fn> }) {
  const tenants: TenantStore = {
    resolveByAccountId: (id) => (id === 1 ? tenant : undefined),
    all: () => [tenant],
  };
  const conversation = {
    getRecentMessages: vi.fn().mockResolvedValue({
      messages: [{ role: 'user', content: 'hi', createdAt: '0' }],
    }),
    postReply: vi.fn().mockResolvedValue(undefined),
    toggleStatus: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatwootConversationClient;
  const brain = { complete: vi.fn().mockResolvedValue(brainReply) } as unknown as BrainClient;
  const audit: AuditSink = { record: vi.fn() };
  const service = new AgentBotService(config, tenants, conversation, brain, audit, () => {}, retriever);
  return { service, conversation, brain, audit };
}

const incoming: ChatwootWebhook = {
  event: 'message_created',
  message_type: 0,
  account: { id: 1 },
  conversation: { id: 42 },
};

describe('AgentBotService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('replies to an incoming customer message via the Brain key', async () => {
    const { service, conversation, brain } = makeService('Here is your answer.');
    await service.handleWebhook(incoming);
    expect(brain.complete).toHaveBeenCalledOnce();
    expect((brain.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('cbk_live_test');
    expect(conversation.postReply).toHaveBeenCalledWith(1, 42, 'bot-tok', 'Here is your answer.');
    expect(conversation.toggleStatus).not.toHaveBeenCalled();
  });

  it('strips the escalation tag and routes to a human', async () => {
    const { service, conversation } = makeService('Let me get a human. [ESCALATE_TO_HUMAN]');
    await service.handleWebhook(incoming);
    expect(conversation.postReply).toHaveBeenCalledWith(1, 42, 'bot-tok', 'Let me get a human.');
    expect(conversation.toggleStatus).toHaveBeenCalledWith(1, 42, 'bot-tok', 'open');
  });

  it('ignores outgoing (bot/agent) messages', async () => {
    const { service, brain } = makeService('x');
    await service.handleWebhook({ ...incoming, message_type: 1 });
    expect(brain.complete).not.toHaveBeenCalled();
  });

  it('ignores messages for an unprovisioned account', async () => {
    const { service, brain } = makeService('x');
    await service.handleWebhook({ ...incoming, account: { id: 999 } });
    expect(brain.complete).not.toHaveBeenCalled();
  });

  it('does not post when the Brain returns empty', async () => {
    const { service, conversation } = makeService('   ');
    await service.handleWebhook(incoming);
    expect(conversation.postReply).not.toHaveBeenCalled();
  });

  it('injects retrieved KB context into the system prompt and audits grounded=true', async () => {
    const retriever = { contextFor: vi.fn().mockResolvedValue('[1] Returns accepted within 45 days. Code prefix ZX9.') };
    const { service, brain, audit } = makeService('The prefix is ZX9.', retriever);
    await service.handleWebhook(incoming);
    expect(retriever.contextFor).toHaveBeenCalledWith('org_demo', 'cbk_live_test', 'hi');
    const systemMsg = (brain.complete as ReturnType<typeof vi.fn>).mock.calls[0][1][0];
    expect(systemMsg.role).toBe('system');
    expect(systemMsg.content).toContain('ZX9'); // KB context is in the system prompt
    expect(systemMsg.content).toContain('Knowledge base');
    expect((audit.record as ReturnType<typeof vi.fn>).mock.calls[0][0].metadata.grounded).toBe(true);
  });

  it('does not inject context when the KB has no hit (grounded=false, base prompt)', async () => {
    const retriever = { contextFor: vi.fn().mockResolvedValue(null) };
    const { service, brain, audit } = makeService('Let me get a human.', retriever);
    await service.handleWebhook(incoming);
    const systemMsg = (brain.complete as ReturnType<typeof vi.fn>).mock.calls[0][1][0];
    expect(systemMsg.content).not.toContain('Knowledge base');
    expect((audit.record as ReturnType<typeof vi.fn>).mock.calls[0][0].metadata.grounded).toBe(false);
  });

  it('hands to a human on a gateway 402 (quota) instead of going silent', async () => {
    const { service, conversation, audit } = makeService('unused');
    const brain = (service as unknown as { brain: { complete: ReturnType<typeof vi.fn> } }).brain;
    brain.complete = vi.fn().mockRejectedValue(Object.assign(new Error('quota'), { status: 402 }));
    await service.handleWebhook(incoming);
    expect(conversation.postReply).toHaveBeenCalledWith(1, 42, 'bot-tok', expect.stringContaining('teammate'));
    expect(conversation.toggleStatus).toHaveBeenCalledWith(1, 42, 'bot-tok', 'open');
    expect((audit.record as ReturnType<typeof vi.fn>).mock.calls[0][0].action).toBe('agent_bot_handoff');
  });

  it('stays silent on a transient 500 error', async () => {
    const { service, conversation } = makeService('unused');
    const brain = (service as unknown as { brain: { complete: ReturnType<typeof vi.fn> } }).brain;
    brain.complete = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    await service.handleWebhook(incoming);
    expect(conversation.postReply).not.toHaveBeenCalled();
  });
});
