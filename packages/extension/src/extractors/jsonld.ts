import type { Extractor, Observation } from '../types';
import { canonicalUrl, stripUrl } from '../url';

/**
 * Generic extractor for schema.org JSON-LD. Handles the shapes seen in the
 * wild so far:
 *   - Product with a single Offer                    (IKEA)
 *   - Product nested inside another node, offers[]   (MediaMarkt: BuyAction.object)
 *   - ProductGroup with hasVariant[] of Products     (Nike)
 *   - AggregateOffer with lowPrice or nested offers
 *   - @graph arrays and top-level arrays
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const PRODUCT_TYPES = new Set(['Product', 'IndividualProduct', 'ProductModel', 'SomeProducts']);
const GTIN_KEYS = ['gtin', 'gtin14', 'gtin13', 'gtin12', 'gtin8'];

function typesOf(node: Json): string[] {
  const t = node?.['@type'];
  if (Array.isArray(t)) return t.map(String);
  return t ? [String(t)] : [];
}

function isProduct(node: Json): boolean {
  return typesOf(node).some((t) => PRODUCT_TYPES.has(t));
}

function* walk(node: Json, depth = 0): Generator<Json> {
  if (depth > 30 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n, depth + 1);
    return;
  }
  yield node;
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') yield* walk(v, depth + 1);
  }
}

export function parseJsonLd(document: Document): Json[] {
  const out: Json[] = [];
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    const text = (s.textContent ?? '').trim();
    if (!text) continue;
    try {
      out.push(JSON.parse(text));
    } catch {
      // Some sites wrap the JSON in an HTML comment or leave a trailing comma. Try once, gently.
      try {
        out.push(JSON.parse(text.replace(/^<!--|-->$/g, '').replace(/,\s*([}\]])/g, '$1')));
      } catch {
        /* unparseable block, skip */
      }
    }
  }
  return out;
}

function asArray(x: Json): Json[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

/** Flatten `offers`, expanding AggregateOffer into its nested offers when present. */
function offersOf(product: Json): Json[] {
  const out: Json[] = [];
  for (const o of asArray(product.offers)) {
    if (!o || typeof o !== 'object') continue;
    const inner = asArray(o.offers).filter((x) => x && typeof x === 'object');
    if (typesOf(o).includes('AggregateOffer') && inner.length) out.push(...inner);
    else out.push(o);
  }
  return out;
}

/** Parse "59.95", 59.95, "1'234.50", "1.234,56", "CHF 59.95" into a number. */
export function parsePrice(raw: Json): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== 'string') return undefined;
  let s = raw.replace(/[^0-9.,-]/g, '');
  if (!s) return undefined;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: the later one is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // Only commas: decimal if exactly two digits follow, else thousands.
    s = /,\d{2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function priceOf(offer: Json): number | undefined {
  return (
    parsePrice(offer.price) ??
    parsePrice(offer.lowPrice) ??
    parsePrice(asArray(offer.priceSpecification)[0]?.price)
  );
}

function currencyOf(offer: Json): string | undefined {
  const c = offer.priceCurrency ?? asArray(offer.priceSpecification)[0]?.priceCurrency;
  return typeof c === 'string' && c.trim() ? c.trim().toUpperCase() : undefined;
}

function countryCode(x: Json): string | undefined {
  if (typeof x === 'string') return /^[A-Za-z]{2}$/.test(x.trim()) ? x.trim().toUpperCase() : undefined;
  if (x && typeof x === 'object') return countryCode(x.name ?? x.identifier ?? x.addressCountry);
  return undefined;
}

function countryOf(offer: Json): string | undefined {
  for (const sd of asArray(offer.shippingDetails)) {
    for (const dest of asArray(sd?.shippingDestination)) {
      const c = countryCode(dest?.addressCountry);
      if (c) return c;
    }
  }
  for (const r of asArray(offer.eligibleRegion)) {
    const c = countryCode(r);
    if (c) return c;
  }
  return undefined;
}

type Key = { type: 'gtin' | 'sku' | 'mpn'; value: string };

function allKeys(product: Json): Key[] {
  const out: Key[] = [];
  for (const k of GTIN_KEYS) {
    const v = product[k];
    if (typeof v === 'string' || typeof v === 'number') {
      const s = String(v).replace(/\s/g, '');
      if (/^\d{8,14}$/.test(s)) {
        out.push({ type: 'gtin', value: s });
        break;
      }
    }
  }
  for (const type of ['sku', 'mpn'] as const) {
    const v = product[type];
    if (typeof v === 'string' || typeof v === 'number') {
      const s = String(v).trim();
      if (s) out.push({ type, value: s });
    }
  }
  return out;
}

/**
 * GTIN beats SKU beats MPN, because a GTIN identifies the same product across
 * retailers and that is what the crowd baseline needs. The one exception is a
 * variant page (Nike: one GTIN per size, one MPN per style). There the key
 * that appears in the page URL is the level at which the site sets the price,
 * so it wins.
 */
function keyOf(product: Json, pagePath: string, hasVariants: boolean): Key | undefined {
  const keys = allKeys(product);
  if (hasVariants) return keys.find((k) => pagePath.includes(k.value.toLowerCase())) ?? keys[0];
  return keys[0];
}

function anyKeyInPath(product: Json, pagePath: string): boolean {
  return allKeys(product).some((k) => pagePath.includes(k.value.toLowerCase()));
}

function safeStrip(u: Json, base: URL): string | undefined {
  if (typeof u !== 'string') return undefined;
  try {
    return stripUrl(new URL(u, base)).replace(/#.*$/, '');
  } catch {
    return undefined;
  }
}

interface Candidate {
  product: Json;
  offer: Json;
  price: number;
  currency: string;
  score: number;
}

export const jsonLdExtractor: Extractor = {
  id: 'jsonld',
  matches: () => true,
  extract(document, url, now = new Date()) {
    const pageUrl = stripUrl(url);
    const canonical = canonicalUrl(document, url);
    const pagePath = decodeURIComponent(url.pathname).toLowerCase();

    const candidates: Candidate[] = [];
    for (const root of parseJsonLd(document)) {
      for (const node of walk(root)) {
        if (!isProduct(node)) continue;
        for (const offer of offersOf(node)) {
          const price = priceOf(offer);
          const currency = currencyOf(offer);
          if (price === undefined || !currency) continue;

          let score = 0;
          const urls = [offer.url, node.url, node['@id']]
            .map((u) => safeStrip(u, url))
            .filter((u): u is string => !!u);
          if (urls.some((u) => u === pageUrl || u === canonical)) score += 3;
          if (anyKeyInPath(node, pagePath)) score += 2;
          if (typeof offer.availability === 'string' && /InStock/i.test(offer.availability)) score += 1;
          candidates.push({ product: node, offer, price, currency, score });
        }
      }
    }
    if (candidates.length === 0) return null;

    // Highest score wins; ties go to the earliest in document order.
    const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
    const key = keyOf(best.product, pagePath, candidates.length > 1);
    const prices = candidates.map((c) => c.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    const obs: Observation = {
      productKey: key?.value ?? canonical,
      productKeyType: key?.type ?? 'url',
      price: best.price,
      currency: best.currency,
      url: canonical,
      observedAt: now.toISOString(),
      source: 'jsonld',
      extractor: 'jsonld',
    };
    if (typeof best.product.name === 'string') obs.name = best.product.name.trim();
    const country = countryOf(best.offer);
    if (country) obs.country = country;
    if (candidates.length > 1) {
      obs.variantCount = candidates.length;
      if (min !== max) obs.priceRange = { min, max };
    }
    return obs;
  },
};
