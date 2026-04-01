type RateLimitOptions = {
  max: number;
  windowMs: number;
};

class InMemoryRateLimiter {
  private hits = new Map<string, number[]>();

  take(key: string, options: RateLimitOptions): boolean {
    const now = Date.now();
    const windowStart = now - options.windowMs;
    const existing = this.hits.get(key) ?? [];
    const recent = existing.filter((ts) => ts >= windowStart);

    if (recent.length >= options.max) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

export const authRateLimiter = new InMemoryRateLimiter();
