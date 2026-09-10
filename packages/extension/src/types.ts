/**
 * One price, as seen on one page, at one moment. This is the unit everything
 * else in Natural Price works on. It carries nothing that identifies a user.
 */
export interface Observation {
  /** Stable identifier for the product across sessions and users. */
  productKey: string;
  /** How productKey was derived. GTIN is best, URL is the fallback. */
  productKeyType: 'gtin' | 'sku' | 'mpn' | 'url';
  name?: string;
  price: number;
  /** ISO 4217, upper case. */
  currency: string;
  /** Destination country shown by the page (ISO 3166-1 alpha-2), never the user's location. */
  country?: string;
  /** Page URL with query string and fragment removed. */
  url: string;
  /** ISO 8601 timestamp. */
  observedAt: string;
  source: 'jsonld' | 'dom';
  /** Which extractor produced this. */
  extractor: string;
  /** When the page lists several variants (sizes, colours), how many had a price. */
  variantCount?: number;
  /** When variants differ in price, the spread. `price` is the best-matching variant. */
  priceRange?: { min: number; max: number };
}

export interface Extractor {
  /** Short stable id, e.g. "jsonld" or "ikea". */
  id: string;
  /** Whether this extractor wants to run for the given page. */
  matches(url: URL): boolean;
  /** Return null when the page is not a product page or no price was found. */
  extract(document: Document, url: URL, now?: Date): Observation | null;
}
