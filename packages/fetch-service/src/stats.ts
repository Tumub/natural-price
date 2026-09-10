import { readFileSync, writeFileSync } from 'node:fs';
import type { CleanResult } from '@natural-price/extension';

/**
 * Aggregate counters per host per UTC day. This is how the beta measures
 * fetch success and how often a difference is found. No install ids, no
 * URLs, no prices. Published at GET /stats.
 */
export interface Counters {
  checks: number;
  fetches: number;
  ok: number;
  blocked: number;
  no_price: number;
  error: number;
  same: number;
  higher: number;
  lower: number;
  unknown: number;
}

const zero = (): Counters => ({ checks: 0, fetches: 0, ok: 0, blocked: 0, no_price: 0, error: 0, same: 0, higher: 0, lower: 0, unknown: 0 });

export class Stats {
  private days = new Map<string, Map<string, Counters>>();
  constructor(private keepDays = 30) {}

  record(host: string, cleans: CleanResult[], verdict: keyof Pick<Counters, 'same' | 'higher' | 'lower' | 'unknown'>, now = new Date()): void {
    const day = now.toISOString().slice(0, 10);
    let hosts = this.days.get(day);
    if (!hosts) {
      hosts = new Map();
      this.days.set(day, hosts);
      this.prune();
    }
    let c = hosts.get(host);
    if (!c) {
      c = zero();
      hosts.set(host, c);
    }
    c.checks++;
    for (const r of cleans) {
      c.fetches++;
      c[r.status]++;
    }
    c[verdict]++;
  }

  snapshot(): Record<string, Record<string, Counters>> {
    const out: Record<string, Record<string, Counters>> = {};
    for (const [day, hosts] of [...this.days].sort()) out[day] = Object.fromEntries(hosts);
    return out;
  }

  /** Success rate over all days for a host, or all hosts when omitted. */
  successRate(host?: string): number | null {
    let ok = 0, fetches = 0;
    for (const hosts of this.days.values())
      for (const [h, c] of hosts) if (!host || h === host) (ok += c.ok), (fetches += c.fetches);
    return fetches ? ok / fetches : null;
  }

  save(file: string): void {
    writeFileSync(file, JSON.stringify(this.snapshot()));
  }

  load(file: string): void {
    let raw: Record<string, Record<string, Counters>>;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return;
    }
    for (const [day, hosts] of Object.entries(raw)) this.days.set(day, new Map(Object.entries(hosts).map(([h, c]) => [h, { ...zero(), ...c }])));
    this.prune();
  }

  private prune(): void {
    const days = [...this.days.keys()].sort();
    while (days.length > this.keepDays) this.days.delete(days.shift()!);
  }
}
