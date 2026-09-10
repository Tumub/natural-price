# Natural Price

**See the price a stranger would get, next to the price you were shown.**

Natural Price is an open-source browser extension and backend that detect
personalised pricing. When you open a product page it reads the price you
see, fetches the same page from a clean, anonymous session, and shows you
the difference. Later, anonymous reports from many users give a second,
harder-to-block baseline: what other people saw for the same product in the
same hour.

[![ci](https://github.com/Tumub/natural-price/actions/workflows/ci.yml/badge.svg)](https://github.com/Tumub/natural-price/actions/workflows/ci.yml)

Status: **phase 1**. The price reader works against real pages in CI. There
is no installable extension yet. Read [PLAN.md](PLAN.md) for the roadmap and
the open issues for what to pick up.

## Try it

```bash
git clone https://github.com/Tumub/natural-price && cd natural-price
npm install
npm test
npm run demo -- https://www.ikea.com/ch/en/p/billy-bookcase-white-00263850/
```

The last command fetches one page anonymously and prints what the extractor
sees. On 2026-09-10 it printed:

```json
{
  "productKey": "002.638.50",
  "productKeyType": "sku",
  "price": 59.95,
  "currency": "CHF",
  "url": "https://www.ikea.com/ch/en/p/billy-bookcase-white-00263850/",
  "observedAt": "2026-09-10T09:40:12.000Z",
  "source": "jsonld",
  "extractor": "jsonld",
  "name": "BILLY Bookcase - white 80x28x202 cm",
  "country": "CH"
}
```

That is the whole idea in one object: what was shown, where, when, in what
currency, for which destination. Everything else compares two of these.

## Why

- Retailers, airlines and hotel platforms personalise prices using your
  cookies, login, device and history. You cannot see it happening.
- The EU already requires traders to disclose a price that was personalised
  through automated decision-making (Consumer Rights Directive, Article
  6(1)(ea), in force since May 2022). Almost nobody discloses visibly.
- The EU Digital Fairness Act, expected to be proposed in late 2026, puts
  personalised pricing squarely in scope. Enforcement will need evidence.
- A crowd-sourced extension found 10 to 30 percent variation across
  retailers back in 2013 ([Mikians et al.](https://arxiv.org/abs/1307.4531)).
  Nobody has kept that tool alive.

## How it works

```
 your browser                       natural-price backend
 ┌─────────────────────┐            ┌──────────────────────────┐
 │ extension           │  url +     │ fetch-service            │
 │  reads price        │  price ───▶│  loads url in a clean    │
 │  (JSON-LD, DOM)     │            │  headless session, from  │
 │  shows badge        │◀── baseline│  several locations       │
 └─────────────────────┘            ├──────────────────────────┤
           │ anonymous              │ crowd-api  (phase 4)     │
           │ observation ──────────▶│  median of what others   │
           └────────────────────────│  saw, same window        │
                                    └──────────────────────────┘
```

Two baselines, because each fails differently:

| Baseline | Strength | Weakness |
|---|---|---|
| Clean-room fetch | Works from day one, no user base needed | Retailers fingerprint and block headless browsers |
| Crowd comparison | Cannot be blocked, matches real sessions | Useless until enough users report the same products |

## What this is not

- **Not a price shield.** Chrome Manifest V3 does not let an extension
  rewrite your requests dynamically, and an anonymous session is often not
  the cheaper one anyway. Natural Price tells you when a lower price exists
  and how to get it. It does not pretend to make you invisible.
- **Not a scraper.** The fetch service loads one page per user request. Bulk
  crawling is out of scope and against the spirit of the project. Respect
  the terms of service of the sites you use.
- **Not a tracker.** See [PRIVACY.md](PRIVACY.md) for exactly what leaves
  your browser. Nothing identifies you.

## Repository layout

```
packages/extension/      browser extension (Manifest V3, Chrome + Firefox)
packages/fetch-service/  clean-room fetch API (Playwright)
packages/crowd-api/      anonymous observation store and aggregation (phase 4)
docs/                    design notes and decisions
```

## Contributing

The easiest and most valuable contribution is a site extractor: one file,
one saved HTML fixture, one test. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

AGPL-3.0. You can fork, modify and self-host. If you run a modified version
as a service, you must publish your changes. This is deliberate: the value of
the crowd data depends on nobody quietly forking the backend and hoarding it.
See [LICENSE](LICENSE).
