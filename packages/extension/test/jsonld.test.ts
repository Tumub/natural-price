import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { jsonLdExtractor, parsePrice } from '../src/extractors/jsonld';

function page(ld: unknown, url = 'https://shop.example/p/abc?utm_source=x#top', canonical?: string) {
  const html = `<html><head>${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
    <script type="application/ld+json">${JSON.stringify(ld)}</script></head><body></body></html>`;
  const dom = new JSDOM(html, { url });
  return jsonLdExtractor.extract(dom.window.document, new URL(url), new Date('2026-01-01T00:00:00Z'));
}

describe('parsePrice', () => {
  it('handles the usual formats', () => {
    expect(parsePrice(59.95)).toBe(59.95);
    expect(parsePrice('59.95')).toBe(59.95);
    expect(parsePrice('1,234.56')).toBe(1234.56);
    expect(parsePrice('1.234,56')).toBe(1234.56);
    expect(parsePrice("1'234.50")).toBe(1234.5);
    expect(parsePrice('CHF 89')).toBe(89);
    expect(parsePrice('12,50')).toBe(12.5);
    expect(parsePrice('1,250')).toBe(1250);
    expect(parsePrice('')).toBeUndefined();
    expect(parsePrice(null)).toBeUndefined();
  });
});

describe('jsonLdExtractor', () => {
  it('reads a plain Product with one Offer and strips the URL', () => {
    const obs = page({ '@type': 'Product', name: 'Thing', sku: 'S1', offers: { '@type': 'Offer', price: '10.00', priceCurrency: 'eur' } });
    expect(obs).toMatchObject({ productKey: 'S1', productKeyType: 'sku', price: 10, currency: 'EUR', name: 'Thing', url: 'https://shop.example/p/abc' });
    expect(obs?.variantCount).toBeUndefined();
  });

  it('prefers GTIN over SKU and uses the canonical link', () => {
    const obs = page(
      { '@type': 'Product', sku: 'S1', gtin13: '4006381333931', offers: { '@type': 'Offer', price: 5, priceCurrency: 'CHF' } },
      'https://shop.example/p/abc?x=1',
      'https://shop.example/products/abc',
    );
    expect(obs).toMatchObject({ productKey: '4006381333931', productKeyType: 'gtin', url: 'https://shop.example/products/abc' });
  });

  it('falls back to the URL as product key', () => {
    const obs = page({ '@type': 'Product', offers: { '@type': 'Offer', price: 5, priceCurrency: 'CHF' } });
    expect(obs).toMatchObject({ productKey: 'https://shop.example/p/abc', productKeyType: 'url' });
  });

  it('reads AggregateOffer lowPrice when no nested offers', () => {
    const obs = page({ '@type': 'Product', offers: { '@type': 'AggregateOffer', lowPrice: '7.5', highPrice: '9', priceCurrency: 'GBP' } });
    expect(obs).toMatchObject({ price: 7.5, currency: 'GBP' });
  });

  it('finds Products nested in @graph and other nodes', () => {
    const obs = page({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, { '@type': 'BuyAction', object: { '@type': 'Product', sku: 'X', offers: [{ '@type': 'Offer', price: 3, priceCurrency: 'USD' }] } }] });
    expect(obs).toMatchObject({ productKey: 'X', price: 3, currency: 'USD' });
  });

  it('picks the variant whose offer URL matches the page and reports the spread', () => {
    const obs = page(
      {
        '@type': 'ProductGroup',
        hasVariant: [
          { '@type': 'Product', mpn: 'A-1', offers: { '@type': 'Offer', url: 'https://shop.example/p/abc/A-1', price: 20, priceCurrency: 'CHF' } },
          { '@type': 'Product', mpn: 'A-2', offers: { '@type': 'Offer', url: 'https://shop.example/p/abc/A-2', price: 25, priceCurrency: 'CHF' } },
        ],
      },
      'https://shop.example/p/abc/A-2?ref=1',
    );
    expect(obs).toMatchObject({ productKey: 'A-2', productKeyType: 'mpn', price: 25, variantCount: 2, priceRange: { min: 20, max: 25 } });
  });

  it('reads destination country from shippingDetails, string or object', () => {
    expect(page({ '@type': 'Product', offers: { '@type': 'Offer', price: 1, priceCurrency: 'CHF', shippingDetails: { shippingDestination: { addressCountry: 'ch' } } } })?.country).toBe('CH');
    expect(page({ '@type': 'Product', offers: { '@type': 'Offer', price: 1, priceCurrency: 'CHF', shippingDetails: { shippingDestination: { addressCountry: { '@type': 'Country', name: 'CH' } } } } })?.country).toBe('CH');
  });

  it('returns null with no product or no price', () => {
    expect(page({ '@type': 'WebSite' })).toBeNull();
    expect(page({ '@type': 'Product', offers: { '@type': 'Offer', priceCurrency: 'CHF' } })).toBeNull();
  });

  it('survives a broken JSON-LD block', () => {
    const html = `<html><head><script type="application/ld+json">{not json</script>
      <script type="application/ld+json">{"@type":"Product","sku":"ok","offers":{"@type":"Offer","price":2,"priceCurrency":"CHF"}}</script></head></html>`;
    const dom = new JSDOM(html, { url: 'https://shop.example/p' });
    expect(jsonLdExtractor.extract(dom.window.document, new URL('https://shop.example/p'))?.productKey).toBe('ok');
  });
});
