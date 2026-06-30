// Account-scoped Chatwoot API calls — ported from
// cognis-platform/apps/bridge/src/features/agent-bot/chatwoot-conversation.client.ts
// Uses the per-tenant Chatwoot token (bot token for writes, admin user token for reads).

export interface ConversationMessages {
  messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }>;
}

interface ChatwootMessageRecord {
  id: number;
  content: string | null;
  message_type: number;
  private: boolean;
  created_at: number | string;
}

export class ChatwootConversationClient {
  constructor(private readonly baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getRecentMessages(
    accountId: number,
    conversationId: number,
    userToken: string,
    limit = 20,
  ): Promise<ConversationMessages> {
    const url = `${this.baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages?per_page=${limit}`;
    const res = await fetch(url, {
      headers: { api_access_token: userToken, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(
        `Chatwoot GET conversation/${conversationId}/messages -> ${res.status} ${res.statusText}`,
      );
    }
    const payload = (await res.json()) as { payload?: ChatwootMessageRecord[] };
    const rows = payload.payload ?? [];
    return {
      messages: rows
        // Only real conversation turns: 0 = incoming (customer), 1 = outgoing (agent/bot).
        // EXCLUDE activity messages (type 2, e.g. "conversation marked open by system ...") and
        // private notes — they would otherwise pollute the LLM context and get echoed back.
        .filter(
          (m) =>
            !m.private &&
            (m.message_type === 0 || m.message_type === 1) &&
            typeof m.content === 'string' &&
            m.content.length > 0,
        )
        .map((m) => ({
          role: m.message_type === 0 ? ('user' as const) : ('assistant' as const),
          content: m.content as string,
          createdAt: String(m.created_at),
        })),
    };
  }

  async postReply(
    accountId: number,
    conversationId: number,
    botToken: string,
    content: string,
    isPrivate = false,
  ): Promise<void> {
    const url = `${this.baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { api_access_token: botToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, message_type: 'outgoing', private: isPrivate }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Chatwoot POST reply failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
  }

  async toggleStatus(
    accountId: number,
    conversationId: number,
    botToken: string,
    status: 'open' | 'resolved' | 'pending',
  ): Promise<void> {
    const url = `${this.baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { api_access_token: botToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    // best-effort; a failed status toggle shouldn't block the reply that already posted
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`Chatwoot toggle_status -> ${res.status}`);
    }
  }
}
