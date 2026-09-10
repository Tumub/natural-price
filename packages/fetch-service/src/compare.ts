import type { Observation } from '@natural-price/extension';
import type { Aggregate, CrowdAnswer } from './crowd';

/**
 * Comparison rules. The written version is docs/comparison-rules.md; keep
 * the two in step. Everything here is deliberately conservative: when in
 * doubt, say "not comparable" rather than invent a difference.
 */

export const WINDOW_MS = 15 * 60 * 1000;
/** Differences under this are noise (rounding, currency display). */
export const SAME_THRESHOLD = 0.005;
/** Two clean fetches "agree" when they are within this of each other. */
export const AGREE_THRESHOLD = 0.005;
/** The crowd counts only when at least this many other installs saw the product. */
export const CROWD_MIN_OTHERS = 5;

export type Confidence = 'low' | 'medium' | 'high';

export interface CleanResult {
  observation: Observation | null;
  status: 'ok' | 'blocked' | 'no_price' | 'error';
  exitLocation: string;
  reason?: string;
}

export interface CrowdSummary {
  window: 'hour' | 'day';
  /** Installs other than the one asking. */
  others: number;
  median: number;
  min: number;
  max: number;
}

export interface Comparison {
  comparable: boolean;
  /** What the difference is measured against. */
  basis: 'clean' | 'crowd' | 'none';
  crowd?: CrowdSummary;
  /** Why not comparable, or notes when it is. */
  reasons: string[];
  yours: { price: number; currency: string };
  clean?: { price: number; currency: string; exitLocation: string };
  /** (yours - clean) / clean. Positive means you were shown more. */
  difference?: number;
  verdict: 'same' | 'higher' | 'lower' | 'unknown';
  confidence: Confidence;
  cleanFetches: { status: CleanResult['status']; exitLocation: string; price?: number }[];
}

function sameKey(a: Observation, b: Observation): boolean {
  if (a.productKeyType === b.productKeyType) return a.productKey === b.productKey;
  // Different key types: fall back to the canonical URL both sides carry.
  return a.url === b.url;
}

/** The crowd window to use: this hour if enough others saw it, else today, else nothing. */
export function pickCrowd(answer: CrowdAnswer | null | undefined): CrowdSummary | undefined {
  const use = (a: Aggregate | null): CrowdSummary | undefined => {
    if (!a) return undefined;
    const others = a.installs - 1;
    if (others < CROWD_MIN_OTHERS) return undefined;
    return { window: a.window, others, median: a.median, min: a.min, max: a.max };
  };
  return use(answer?.hour ?? null) ?? use(answer?.day ?? null);
}

export function compare(yours: Observation, cleans: CleanResult[], crowdAnswer: CrowdAnswer | null = null, now = new Date()): Comparison {
  const reasons: string[] = [];
  const crowd = pickCrowd(crowdAnswer);
  const base: Comparison = {
    comparable: false,
    basis: 'none',
    ...(crowd ? { crowd } : {}),
    reasons,
    yours: { price: yours.price, currency: yours.currency },
    verdict: 'unknown',
    confidence: 'low',
    cleanFetches: cleans.map((c) => ({
      status: c.status,
      exitLocation: c.exitLocation,
      ...(c.observation ? { price: c.observation.price } : {}),
    })),
  };

  const yoursAt = Date.parse(yours.observedAt);
  if (!Number.isFinite(yoursAt) || Math.abs(now.getTime() - yoursAt) > WINDOW_MS) {
    reasons.push('your observation is older than the 15 minute window');
    return base;
  }

  const usable = cleans.filter((c) => c.status === 'ok' && c.observation);
  if (usable.length === 0) {
    const blocked = cleans.filter((c) => c.status === 'blocked').length;
    reasons.push(cleans.length === 0 ? 'no clean session was available' : blocked ? 'the site refused the clean fetch' : 'no clean price could be read');
    return crowdOnly(base, yours, crowd, reasons);
  }

  const valid: { c: CleanResult; o: Observation }[] = [];
  for (const c of usable) {
    const o = c.observation!;
    if (o.currency !== yours.currency) {
      reasons.push(`currency differs (${yours.currency} vs ${o.currency} from ${c.exitLocation})`);
      continue;
    }
    if (yours.country && o.country && yours.country !== o.country) {
      reasons.push(`destination differs (${yours.country} vs ${o.country} from ${c.exitLocation})`);
      continue;
    }
    if (!sameKey(yours, o)) {
      reasons.push(`different product (${yours.productKey} vs ${o.productKey} from ${c.exitLocation})`);
      continue;
    }
    if (Math.abs(Date.parse(o.observedAt) - yoursAt) > WINDOW_MS) {
      reasons.push(`clean fetch from ${c.exitLocation} outside the 15 minute window`);
      continue;
    }
    valid.push({ c, o });
  }
  if (valid.length === 0) return crowdOnly(base, yours, crowd, reasons);

  // Confidence: one fetch is low. Two fetches from different exits that agree is medium.
  const exits = new Set(valid.map((v) => v.c.exitLocation));
  const prices = valid.map((v) => v.o.price);
  const spread = (Math.max(...prices) - Math.min(...prices)) / Math.min(...prices);
  let confidence: Confidence = 'low';
  if (valid.length >= 2 && exits.size >= 2 && spread <= AGREE_THRESHOLD) {
    confidence = 'medium';
    if (exits.has('private-tab')) reasons.push('a private tab on your device and the server agree');
  }
  if (valid.length >= 2 && spread > AGREE_THRESHOLD) {
    reasons.push('clean fetches disagree with each other; the site may be A/B testing or pricing by location');
  }

  const ref = valid[0]!;
  const difference = (yours.price - ref.o.price) / ref.o.price;
  const verdict = Math.abs(difference) < SAME_THRESHOLD ? 'same' : difference > 0 ? 'higher' : 'lower';
  if (!yours.country || !ref.o.country) reasons.push('destination country not shown by the page; assumed the same');
  reasons.push('tax treatment assumed identical: both prices come from the same page template');

  // The crowd can raise confidence to high when it agrees with the clean fetch, and only then.
  if (crowd) {
    const gap = Math.abs(ref.o.price - crowd.median) / crowd.median;
    if (gap <= AGREE_THRESHOLD) {
      confidence = 'high';
      reasons.push(`${crowd.others} other people saw the same price ${crowd.window === 'hour' ? 'this hour' : 'today'}`);
    } else {
      reasons.push(`the clean fetch and the crowd median differ by ${(gap * 100).toFixed(1)}%; the site may price by session or time`);
    }
  }

  return {
    ...base,
    comparable: true,
    basis: 'clean',
    clean: { price: ref.o.price, currency: ref.o.currency, exitLocation: ref.c.exitLocation },
    difference,
    verdict,
    confidence,
  };
}

/** No usable clean fetch: fall back to the crowd median alone, at medium confidence. */
function crowdOnly(base: Comparison, yours: Observation, crowd: CrowdSummary | undefined, reasons: string[]): Comparison {
  if (!crowd) return base;
  const difference = (yours.price - crowd.median) / crowd.median;
  reasons.push(`compared with what ${crowd.others} other people saw ${crowd.window === 'hour' ? 'this hour' : 'today'}`);
  return {
    ...base,
    comparable: true,
    basis: 'crowd',
    difference,
    verdict: Math.abs(difference) < SAME_THRESHOLD ? 'same' : difference > 0 ? 'higher' : 'lower',
    confidence: 'medium',
  };
}
