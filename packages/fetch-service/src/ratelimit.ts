/** In-memory sliding counters per key. Enough for one VPS; a shared store comes with phase 4. */
export class RateLimiter {
  private minute = new Map<string, number[]>();
  private day = new Map<string, number[]>();

  constructor(
    private perMinute = 10,
    private perDay = 100,
  ) {}

  /** Returns true when the call is allowed and records it. */
  allow(key: string, now = Date.now()): boolean {
    const m = prune(this.minute.get(key) ?? [], now - 60_000);
    const d = prune(this.day.get(key) ?? [], now - 86_400_000);
    if (m.length >= this.perMinute || d.length >= this.perDay) {
      this.minute.set(key, m);
      this.day.set(key, d);
      return false;
    }
    m.push(now);
    d.push(now);
    this.minute.set(key, m);
    this.day.set(key, d);
    return true;
  }

  /** Drop keys that have not been seen for a day. Call from a timer. */
  sweep(now = Date.now()): void {
    for (const [k, v] of this.day) if (prune(v, now - 86_400_000).length === 0) {
      this.day.delete(k);
      this.minute.delete(k);
    }
  }
}

function prune(ts: number[], since: number): number[] {
  let i = 0;
  while (i < ts.length && ts[i]! < since) i++;
  return i ? ts.slice(i) : ts;
}
