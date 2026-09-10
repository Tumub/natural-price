# Launch sites for the phase 2 MVP

Decided 2026-09-10. Criteria from PLAN.md: plausible personalisation,
JSON-LD or a stable DOM, no login wall on the product page, usable from
Switzerland and the EU. Added after phase 1: **the site must answer an
anonymous fetch**, because a clean-room baseline that is always blocked
proves nothing.

## Chosen

| Site | Why | Key |
|---|---|---|
| ikea.com (CH) | Server-rendered JSON-LD with destination country. Large audience. Regional pricing differences are well known. | SKU |
| mediamarkt.ch | JSON-LD with GTIN, marketplace sellers, frequent price changes. Cross-retailer key. | GTIN |
| nike.com (CH) | ProductGroup with per-size variants, member pricing exists, exercises the variant logic. | MPN |

## Deferred, with reasons

The plan called for one flight and one hotel platform. Both are deferred to
phase 3 rather than dropped:

- Flight and hotel search results carry no JSON-LD `Offer` and are behind
  aggressive bot detection. Every anonymous fetch tried in the fixture hunt
  returned 403 on comparable sites.
- They need proxies and fingerprint work, which is phase 3 scope (issue #9).
- Phase 2 has to prove the pipeline end to end. That needs sites that answer.

## Rejected in the fixture hunt (2026-09-10, anonymous fetch, plain Chrome UA)

403: galaxus.ch, decathlon.ch, bol.com, zalando.ch, conrad.ch, lego.com, hm.com.
200 without JSON-LD: uniqlo.com (needs a DOM extractor; good first issue).

Revisit when phase 3 proxy results are in.
