# Privacy

This file is the contract. If the code sends something that is not listed
here, that is a bug and should be reported as one.

## What the extension sends to the fetch service

The machine-readable version is [docs/payload-schema.json](docs/payload-schema.json).
Anything not in that schema is rejected by the service.

| Field | Example | Why |
|---|---|---|
| `url` | `https://example.com/p/12345` | The page to fetch. Canonical URL; query string and fragment removed before sending. |
| `productKey`, `productKeyType` | `4006381333931`, `gtin` | Identifies the product. GTIN, SKU, MPN or the URL, all read from the page. |
| `name` | `BILLY Bookcase` | Product name from the page, for the badge and later for the crowd view. |
| `price` | `129.00` | What you saw. |
| `currency` | `EUR` | To compare like with like. |
| `country` | `CH` | Destination country as shown on the page, not your IP. Needed because prices legitimately differ by destination. |
| `observedAt` | `2026-10-03T14:05:00Z` | Time window matching. |
| `source`, `extractor` | `jsonld`, `jsonld` | Which reader produced the price, so broken readers can be found. |
| `variantCount`, `priceRange` | `29`, `{min, max}` | Only on pages listing several variants. Read from the page. |
| `installId` | SHA-256 of a random UUID | Rate limiting only. Not linked to any account. Regenerated if you reinstall. |

## What the extension will send to the crowd API (phase 4)

The same fields, plus a `product_key` (canonical URL or GTIN), with
`observed_at` rounded to the hour and `install_id` hashed again with a daily
salt so observations from the same install cannot be joined across days.

## What is never sent

- Cookies, login state, or anything from your session on the retailer.
- Your IP address is seen by the server like any HTTP request but is not
  stored. Logs strip it.
- Browsing history, other tabs, or pages that are not product pages.
- Your name, email, account, or any identifier tied to you.

## What the server stores

- Fetch service: a rate-limit counter per hashed install id, expiring after
  24 hours, and one log line per check with time, hostname, duration, fetch
  statuses and verdict. No IP, no install id, no path, no query.
- Crowd API: the anonymised observations above, kept indefinitely, published
  in aggregate.

## Legal basis

The project is run from Switzerland and serves EU users. The Swiss Federal
Act on Data Protection and the GDPR apply. The design goal is that no
personal data is processed at all, so that no consent flow is needed. If
that ever changes, this file changes first.
