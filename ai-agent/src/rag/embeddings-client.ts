import OpenAI from 'openai';

// Embeddings via the Brain gateway (cognis-embed = bge-small, 1536-dim), per-org key.
// Reuses the Brain's shared embedding model — NO second embedding stack (V2 rule).
export class EmbeddingsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async embed(brainApiKey: string, inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) return [];
    const client = new OpenAI({ baseURL: this.baseUrl, apiKey: brainApiKey });
    // Force float arrays. The SDK defaults to encoding_format:'base64'; the Brain's
    // embeddings backend returns floats, so base64-decoding yields all-zero vectors.
    const res = await client.embeddings.create({ model: this.model, input: inputs, encoding_format: 'float' });
    return res.data.map((d) => d.embedding as number[]);
  }
}
