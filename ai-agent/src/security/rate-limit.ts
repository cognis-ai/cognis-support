// Fixed-window per-key rate limiter (V3 edge protection). In-memory is fine for a single
// sidecar instance; a Redis-backed limiter implements the same shape for horizontal scale.
export class RateLimiter {
  private hits = new Map<string, { count: number; window: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  allow(key: string, now: number = Date.now()): boolean {
    if (this.limit <= 0) return true; // 0/negative = disabled
    const window = Math.floor(now / this.windowMs);
    const e = this.hits.get(key);
    if (!e || e.window !== window) {
      this.hits.set(key, { count: 1, window });
      return true;
    }
    e.count += 1;
    return e.count <= this.limit;
  }
}
