/**
 * Per-host circuit breaker. After `threshold` blocked fetches inside
 * `windowMs`, the host is paused for `cooldownMs`. A paused host answers
 * "blocked, circuit open" without touching the site or spending proxy
 * bandwidth. One clean success closes it again.
 */
export class Breaker {
  private blocked = new Map<string, number[]>();
  private openUntil = new Map<string, number>();

  constructor(
    private threshold = 3,
    private windowMs = 10 * 60_000,
    private cooldownMs = 15 * 60_000,
  ) {}

  isOpen(host: string, now = Date.now()): boolean {
    const until = this.openUntil.get(host);
    if (until === undefined) return false;
    if (now >= until) {
      this.openUntil.delete(host);
      this.blocked.delete(host);
      return false;
    }
    return true;
  }

  recordBlocked(host: string, now = Date.now()): void {
    const ts = (this.blocked.get(host) ?? []).filter((t) => t > now - this.windowMs);
    ts.push(now);
    this.blocked.set(host, ts);
    if (ts.length >= this.threshold) this.openUntil.set(host, now + this.cooldownMs);
  }

  recordOk(host: string): void {
    this.blocked.delete(host);
    this.openUntil.delete(host);
  }

  /** Hosts currently paused, with when they reopen. */
  snapshot(now = Date.now()): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [h, until] of this.openUntil) if (until > now) out[h] = new Date(until).toISOString();
    return out;
  }
}
