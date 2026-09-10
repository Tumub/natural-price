import type { Extractor, Observation } from '../types';
import { stripUrl } from '../url';
import { bookingExtractor } from './booking';
import { jsonLdExtractor } from './jsonld';

/**
 * Site-specific extractors go here, most specific first. Each is one file in
 * this folder, one fixture under fixtures/<site>/, one expected.json.
 * The generic JSON-LD extractor always runs last as the fallback.
 */
export const siteExtractors: Extractor[] = [bookingExtractor];

/** The URL that identifies the offer: site rule when one exists, else query and fragment removed. */
export function normalizeUrl(input: string | URL): string {
  const url = new URL(input.toString());
  const site = siteExtractors.find((e) => e.matches(url) && e.normalizeUrl);
  return site?.normalizeUrl ? site.normalizeUrl(url) : stripUrl(url);
}

export function extract(document: Document, url: URL, now = new Date()): Observation | null {
  for (const e of siteExtractors) {
    if (!e.matches(url)) continue;
    const obs = e.extract(document, url, now);
    if (obs) return obs;
  }
  return jsonLdExtractor.extract(document, url, now);
}

export { jsonLdExtractor, bookingExtractor };
