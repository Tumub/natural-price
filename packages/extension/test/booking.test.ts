import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHtml } from '../src/dom';
import { bookingExtractor, normalizeBookingUrl } from '../src/extractors/booking';
import { normalizeUrl } from '../src/extractors/index';

const fixture = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'booking', 'hotelspalentorbasel.html'), 'utf8');
const stay = 'checkin=2026-09-28&checkout=2026-10-02&group_adults=2&group_children=0&no_rooms=1';
const messy = `https://www.booking.com/hotel/ch/hotelspalentorbasel.en-gb.html?aid=2311236&label=en-ch-booking-desktop-xyz&sid=41ef3b31af6413cc774d050c79f36d51&all_sr_blocks=6522210_361157441_2_2_0_369127&${stay}&dest_id=-2551183&highlighted_blocks=6522210_361157441_1_2_0_369127&srpvid=4eb95289799f0115&sb_price_type=total#room`;

describe('booking', () => {
  it('keeps the stay and drops the session and tracking', () => {
    const u = normalizeBookingUrl(new URL(messy));
    expect(u).toBe(`https://www.booking.com/hotel/ch/hotelspalentorbasel.en-gb.html?${stay}&highlighted_blocks=6522210_361157441_1_2_0_369127&sb_price_type=total`);
    expect(normalizeUrl(messy)).toBe(u);
    expect(normalizeUrl('https://www.ikea.com/ch/en/p/x/?utm=1#a')).toBe('https://www.ikea.com/ch/en/p/x/');
  });
  it('matches hotel pages only', () => {
    expect(bookingExtractor.matches(new URL(messy))).toBe(true);
    expect(bookingExtractor.matches(new URL('https://www.booking.com/searchresults.html?ss=basel'))).toBe(false);
    expect(bookingExtractor.matches(new URL('https://www.ikea.com/ch/en/p/x/'))).toBe(false);
  });
  it('observes the highlighted row when the URL names one', () => {
    const obs = bookingExtractor.extract(parseHtml(fixture, messy), new URL(messy), new Date('2026-09-10T12:00:00Z'));
    expect(obs).toMatchObject({ price: 784, currency: 'CHF', productKey: 'hotelspalentorbasel:6522210_361157441_1_2_0_369127:2026-09-28:2026-10-02', country: 'CH', extractor: 'booking', variantCount: 4 });
    expect(obs!.url).not.toMatch(/sid=|aid=/);
  });
  it('returns null without a room table', () => {
    expect(bookingExtractor.extract(parseHtml('<html><body><p>Sold out</p></body></html>', messy), new URL(messy))).toBeNull();
  });
});
