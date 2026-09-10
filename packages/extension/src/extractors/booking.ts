import type { Extractor, Observation } from '../types';
import { parsePrice } from './jsonld';

/**
 * Booking.com hotel pages. No structured price: the room table (#hprt-table)
 * carries one row per room type and rate, each with a block id and the
 * rounded price for the stay. The stay itself lives in the query string
 * (dates, guests, rooms), so unlike shops the URL must keep those and drop
 * the rest: aid, label, sid (a session id), srpvid and other tracking.
 *
 * The observed row is the one Booking highlighted (highlighted_blocks in the
 * URL) or, failing that, the first row, which Booking picks as the typical
 * room for the party size.
 */

const KEEP = ['checkin', 'checkout', 'group_adults', 'group_children', 'no_rooms', 'selected_currency', 'highlighted_blocks', 'sb_price_type'];

export function normalizeBookingUrl(url: URL): string {
  const u = new URL(url.origin + url.pathname);
  for (const k of KEEP) {
    const v = url.searchParams.get(k);
    if (v) u.searchParams.set(k, v);
  }
  return u.toString();
}

export const bookingExtractor: Extractor = {
  id: 'booking',
  matches: (url) => /(^|\.)booking\.com$/.test(url.hostname) && url.pathname.startsWith('/hotel/'),
  normalizeUrl: normalizeBookingUrl,
  extract(document, url, now = new Date()) {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('#hprt-table tbody tr[data-block-id]'));
    if (rows.length === 0) return null;
    const wanted = url.searchParams.get('highlighted_blocks')?.split(',')[0];
    const row = rows.find((r) => r.getAttribute('data-block-id') === wanted) ?? rows[0]!;
    const blockId = row.getAttribute('data-block-id')!;
    const text = row.querySelector('.bui-price-display__value')?.textContent?.trim() ?? '';
    const currency = /\b([A-Z]{3})\b/.exec(text)?.[1];
    const price = parsePrice(row.getAttribute('data-hotel-rounded-price')) ?? parsePrice(text);
    if (!currency || price === undefined) return null;

    const slug = url.pathname.split('/').filter(Boolean).slice(-1)[0]?.replace(/\.[a-z-]+\.html$/, '') ?? url.pathname;
    const checkin = url.searchParams.get('checkin') ?? '';
    const checkout = url.searchParams.get('checkout') ?? '';
    const hotelName = document.querySelector('h2.pp-header__title, [data-testid="title"]')?.textContent?.trim();
    const roomName = row.querySelector('.hprt-roomtype-icon-link, .hprt-roomtype-link')?.textContent?.trim();
    const country = /^\/hotel\/([a-z]{2})\//.exec(url.pathname)?.[1]?.toUpperCase();

    const obs: Observation = {
      productKey: `${slug}:${blockId}:${checkin}:${checkout}`,
      productKeyType: 'sku',
      price,
      currency,
      url: normalizeBookingUrl(url),
      observedAt: now.toISOString(),
      source: 'dom',
      extractor: 'booking',
      variantCount: rows.length,
    };
    if (country) obs.country = country;
    const name = [hotelName, roomName].filter(Boolean).join(', ');
    if (name) obs.name = name;
    const prices = rows.map((r) => parsePrice(r.getAttribute('data-hotel-rounded-price'))).filter((p): p is number => p !== undefined);
    if (prices.length > 1) {
      const min = Math.min(...prices), max = Math.max(...prices);
      if (min !== max) obs.priceRange = { min, max };
    }
    return obs;
  },
};
