import type { Observation } from '@natural-price/extension';

/** Mirrors Aggregate and CrowdAnswer in packages/crowd-api/src/store.ts. */
export interface Aggregate {
  window: 'hour' | 'day';
  bucket: string;
  n: number;
  installs: number;
  median: number;
  min: number;
  max: number;
}
export interface CrowdAnswer {
  hour: Aggregate | null;
  day: Aggregate | null;
}

/**
 * Server-to-server client for the crowd API. Forwards the same validated
 * body the extension sent. Any failure returns null: the crowd is a bonus,
 * never a dependency.
 */
export class CrowdClient {
  constructor(
    private origin: string,
    private timeoutMs = 3000,
  ) {}

  async observe(observation: Observation, installId: string): Promise<CrowdAnswer | null> {
    try {
      const res = await fetch(new URL('/observe', this.origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ observation, installId }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return null;
      return (await res.json()) as CrowdAnswer;
    } catch {
      return null;
    }
  }
}
