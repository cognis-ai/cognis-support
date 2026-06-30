import OpenAI from 'openai';

// The LLM swap: instead of Bridge's @cognis/llm-client -> LiteLLM, Chat calls the
// Cognis Brain gateway (OpenAI-compatible) with each tenant's OWN cbk_live_ key.
// DeepSeek/Qwen live BEHIND the gateway — the sidecar holds no DeepSeek key and never
// hits api.deepseek.com directly (that would bypass Brain metering/audit/rate-limit + Trust layer).

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Carries the gateway HTTP status so the loop can react to its contract:
// 400 = injection blocked, 402 = quota exceeded, 403 = model/tier denied.
export class BrainError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BrainError';
  }
}

export class BrainClient {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  /**
   * One completion through the Brain gateway, authed by the tenant's per-org key.
   * @param brainApiKey the org's cbk_live_ key
   */
  async complete(
    brainApiKey: string,
    messages: ChatMessage[],
    opts: { temperature: number; maxTokens: number; user: string },
  ): Promise<string> {
    const client = new OpenAI({ baseURL: this.baseUrl, apiKey: brainApiKey });
    try {
      const res = await client.chat.completions.create({
        model: this.model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        user: opts.user,
      });
      return res.choices[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      const status = (err as { status?: number }).status;
      throw new BrainError((err as Error).message, status);
    }
  }
}
