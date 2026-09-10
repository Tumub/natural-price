import type { Observation } from './types';

export interface CheckRequest {
  type: 'check';
  observation: Observation;
}

/** Mirrors Comparison in packages/fetch-service/src/compare.ts. */
export interface CheckResponse {
  comparable: boolean;
  reasons: string[];
  yours: { price: number; currency: string };
  clean?: { price: number; currency: string; exitLocation: string };
  difference?: number;
  verdict: 'same' | 'higher' | 'lower' | 'unknown';
  confidence: 'low' | 'medium' | 'high';
  cleanFetches: { status: string; exitLocation: string; price?: number }[];
  error?: string;
}
