# Natural Price: project plan

Six months, four build phases, then a sustainability phase. Dates assume a
start on 2026-09-10 and a single part-time maintainer with occasional
contributors. Slip is expected; scope is fixed per phase, dates are not.

## Decisions already made

| Decision | Choice | Reason |
|---|---|---|
| Licence | AGPL-3.0 | Prevents a silent hosted fork that hoards crowd data. Plausible and Sentry model. |
| Baseline strategy | Clean-room fetch first, crowd second | Fetch works with zero users. Crowd needs scale but cannot be blocked. |
| Browser target | Chrome first, Firefox in phase 4 | Audience size. Firefox keeps blocking webRequest, which matters for later experiments. |
| Sterile browsing shield | Out of scope | Manifest V3 allows only static header rules and forbids touching referer. Not buildable in Chrome. |
| Price extraction | schema.org JSON-LD `Offer` first, per-site DOM fallback | Covers most large retailers with one generic extractor. |
| Clean session on the device (added 2026-09-10) | Optional private tab on the user's machine, alongside or instead of the server | First production day showed MediaMarkt blocking the datacenter address. A private tab uses the user's own address, costs nothing, and covers the commonest case, logged in versus not. The server stays for location and device effects. |
| No server in the published build (added 2026-09-10) | `NP_SERVER_ENABLED` is off, so released builds have no server capability at all | Owner decision. The crowd baseline needs many users on one product in one hour, so it is worth little at beta scale, while offering a hosted service now would require a named controller, a processing agreement, a processing record and a lawyer. Deferred until the beta is large enough for the crowd to mean something. |
| Device-first by default (added 2026-09-10) | The private tab and a local comparison are the default; the server is opt-in and limited in code to four named companies; the reader runs on all websites | Owner decision. It makes the privacy notice short and true, removes most of GDPR from most of the product, avoids datacenter blocking, and keeps the server small. The cost is a broader install permission and a harder store review, answered by the fact that all-sites access is for reading and the default sends nothing. |

## Phase 1: Foundation (2026-09-10 to 2026-09-30)

Goal: a repo a stranger can contribute to, and one extractor that runs.

- Repo, licence, README, CONTRIBUTING, PRIVACY, issue templates.
- Extractor interface: `extract(document, url) -> Observation | null`.
- Fixture harness: saved HTML per site, one test per fixture.
- Generic JSON-LD `Offer` extractor with tests against three fixtures.
- CI running the fixture tests on every pull request.
- Demo GIF in the README of the extractor reading a real page.

Exit metric: CI green, one real page extracted, README demo present.

## Phase 2: MVP on three sites (October 2026)

Goal: a working extension that shows "your price vs clean price".

- Choose three launch sites. Criteria: documented personalisation, JSON-LD
  or stable DOM, no login wall on the product page. Likely one flight
  search, one hotel platform, one large e-commerce site.
- Fetch service: single endpoint, Playwright, fresh context per request,
  generic desktop user agent, no cookies, two or three exit locations.
- Comparison rules: same currency, same destination country, tax treatment
  normalised, both observations within a 15-minute window.
- Extension badge: your price, clean price, difference, confidence
  (single fetch = low, multiple agreeing fetches = high).
- Deployed fetch service on one small VPS behind a rate limit.

Exit metric: three sites working end to end for the maintainer, badge shown
within 5 seconds, false positive rate under 10 percent on 50 manual checks.

## Phase 3: Private beta (November 2026)

Goal: 50 testers, real data, real blocking.

- Recruit 50 testers. Sources: privacy and consumer-rights communities,
  Hacker News "Show HN", personal network.
- Measure: how often the fetch is blocked per site, how often a difference
  is found, whether users act on it.
- Handle blocking: residential proxy trial, browser fingerprint hygiene,
  backoff per site. Record what works in `docs/`.
- Privacy review of the actual payload against PRIVACY.md. Fix any leak.
- Add the "open in a private window to get this price" action.

Exit metric: 30 weekly active testers, fetch success rate over 70 percent on
the three sites, zero privacy findings open.

## Phase 4: Crowd layer and public launch (December 2026 to January 2027)

Goal: the baseline that cannot be blocked, and a public listing.

- Crowd API: append-only anonymous observations (product key, price,
  currency, country, hour bucket, hashed install id). No URL query strings.
- Aggregation: median and spread per product per hour. Show "you were
  quoted X percent above what N other people saw today" when N is large
  enough to be meaningful.
- Firefox build and AMO listing. Chrome Web Store listing.
- Public launch post with the beta findings as the headline.

Exit metric: listings live, 500 installs in the first month, crowd baseline
available on at least 100 products.

## Phase 5: Sustainability (February 2027 onward)

- Hosted service stays free for individuals. Costs covered by donations
  and, if there is demand, a paid API for researchers and consumer bodies.
- Publish the aggregated dataset under an open licence on a schedule.
- Approach consumer associations and regulators preparing Digital Fairness
  Act enforcement. They need exactly this evidence.
- Keep the extractor pool alive: broken-selector issues are the main
  maintenance load. Make it trivial to fix with a fixture and a test.

## Architecture

**Extension** (Manifest V3). Content script runs on product pages, tries the
JSON-LD extractor, then the site-specific extractor if one exists. Sends
`{url_without_query, price, currency, country, timestamp}` to the fetch
service and, from phase 4, an anonymised observation to the crowd API.
Shows a badge. Stores nothing about the user beyond a random install id.

**Fetch service.** Node plus Playwright. Fresh browser context per request.
Rotates exit location. Returns the extracted clean price or a
`blocked` status. Rate limited per install id. Runs on a small VPS; a
Cloudflare Worker cannot run a browser cheaply enough.

**Crowd API** (phase 4). Append-only observations, aggregation job per hour,
read endpoint returning median, spread and count per product key. Product
key is the canonical URL or a GTIN when available.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Headless fetch blocked by target sites | High | High | Proxies, fingerprint hygiene, and the crowd baseline as the long-term answer |
| Takedown or ToS complaint from a retailer | Medium | Medium | One page per user request, no bulk crawling, clear README statement, respond fast |
| A/B tests read as personalisation | High | Medium | Confidence signal; require agreeing fetches before a strong claim |
| Dynamic pricing confused with personalisation | High | Medium | Tight time window, same currency and destination only |
| Manifest V3 restricts a needed capability | Medium | Medium | Keep the extension read-only; all logic server side |
| Privacy incident | Low | High | Minimal payload, no query strings, hashed install id, published schema |
| Nobody installs it | Medium | High | Ship a visible demo early; launch with real beta findings, not a promise |
| Proxy cost outruns donations | Medium | Medium | Cap fetches per user per day; crowd baseline is free |

## Budget (monthly, phases 2 to 4)

| Item | Estimate |
|---|---|
| VPS for fetch service | 20 to 40 EUR |
| Residential proxy trial | 50 to 150 EUR |
| Domain and email | 5 EUR |
| Chrome Web Store developer fee | 5 USD once |
| Firefox AMO | free |
| **Total** | **roughly 100 to 200 EUR per month** |

## Metrics by phase

| Phase | Metric | Target |
|---|---|---|
| 1 | Extractor fixtures passing in CI | 3 |
| 2 | Sites working end to end | 3 |
| 2 | Badge latency | under 5 s |
| 3 | Weekly active testers | 30 |
| 3 | Fetch success rate | over 70 percent |
| 4 | Installs in first public month | 500 |
| 4 | Products with a crowd baseline | 100 |

## First twelve issues

Opened on day one so contributors have somewhere to start. See the issue
tracker; the list is reproduced here for anyone reading offline.

1. Define the extractor interface and fixture test harness
2. Implement the generic JSON-LD Offer extractor
3. Choose the three launch sites and record the criteria
4. Set up CI to run extractor fixture tests on every pull request
5. Build the clean-room fetch endpoint with Playwright
6. Write the comparison rules: time window, currency, destination, tax
7. Build the extension badge with a confidence level
8. Define the exact outbound payload schema and review PRIVACY.md against it
9. Proxy and exit-location strategy, with a blocking log per site
10. Beta tester recruitment plan for 50 users
11. Crowd API: anonymous observation schema and hourly aggregation
12. Prepare Chrome Web Store and Firefox AMO listings
