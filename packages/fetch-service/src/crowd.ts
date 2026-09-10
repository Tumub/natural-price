import type { CrowdAnswer, Observation } from '@natural-price/extension';

export type { Aggregate, CrowdAnswer } from '@natural-price/extension';

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
