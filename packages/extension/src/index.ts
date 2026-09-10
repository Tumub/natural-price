export type { Observation, Extractor } from './types';
export type { Aggregate, CrowdAnswer, CleanResult, Comparison, Confidence, CrowdSummary } from './compare';
export { compare, pickCrowd, CROWD_MIN_OTHERS, WINDOW_MS } from './compare';
export { extract, normalizeUrl, siteExtractors, jsonLdExtractor } from './extractors/index';
export { stripUrl, canonicalUrl } from './url';
