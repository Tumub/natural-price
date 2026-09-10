# Privacy

This file is the contract. If the code sends something that is not listed
here, that is a bug and should be reported as one.

## What the extension sends to the fetch service

The machine-readable version is [docs/payload-schema.json](docs/payload-schema.json).
Anything not in that schema is rejected by the service.

| Field | Example | Why |
|---|---|---|
| `url` | `https://example.com/p/12345` | The page to fetch. Canonical URL; query string and fragment removed before sending. On Booking.com the dates, guests, rooms and currency are kept because they define the price; the session id and tracking parameters are dropped. |
| `productKey`, `productKeyType` | `4006381333931`, `gtin` | Identifies the product. GTIN, SKU, MPN or the URL, all read from the page. |
| `name` | `BILLY Bookcase` | Product name from the page, for the badge and later for the crowd view. |
| `price` | `129.00` | What you saw. |
| `currency` | `EUR` | To compare like with like. |
| `country` | `CH` | Destination country as shown on the page, not your IP. Needed because prices legitimately differ by destination. |
| `observedAt` | `2026-10-03T14:05:00Z` | Time window matching. |
| `source`, `extractor` | `jsonld`, `jsonld` | Which reader produced the price, so broken readers can be found. |
| `variantCount`, `priceRange` | `29`, `{min, max}` | Only on pages listing several variants. Read from the page. |
| `installId` | SHA-256 of a random UUID | Rate limiting only. Not linked to any account. Regenerated if you reinstall. |
| `clientClean` | same fields as the observation | Only in private-tab or both mode: the same page read in a private tab on your device. Same address, no cookies. |
| `skipServer` | `true` | Only in private-tab mode: tells the service not to open the page itself. |

## What the fetch service forwards to the crowd API

The extension makes one network call, to the fetch service. When a crowd
API is configured, the fetch service forwards the same validated body
there, server to server. The crowd API stores:

| Stored | From | Not stored |
|---|---|---|
| `product_key`, `key_type`, `currency`, `country`, `price` | the observation | the page URL and path (only the hostname is kept) |
| `hour` | `observedAt` rounded down to the UTC hour | the minute or second |
| `install_hash` | the already-hashed install id, hashed again with a salt that changes every UTC day | anything that links two days of the same install |

One row per install per product per hour: a repeat replaces the earlier
row. Aggregates (count, distinct installs, minimum, maximum, median) are
computed with the SQL in [docs/crowd-aggregation.sql](docs/crowd-aggregation.sql)
and published as an open dataset; see [docs/open-data.md](docs/open-data.md).

## The private tab on your device

In private-tab or both mode the extension opens the product page once more
in a tab with no cookies, login or history (an incognito window in Chrome,
a temporary container in Firefox), reads the price with the same code, and
closes the tab. The shop sees one extra anonymous page view from your
address. The extension reads nothing else from that tab and keeps nothing
from it.

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
- Crowd API: the rows described above, kept indefinitely, published only in
  aggregate.

## Legal basis

The project is run from Switzerland and serves EU users. The Swiss Federal
Act on Data Protection and the GDPR apply. The design goal is that no
personal data is processed at all, so that no consent flow is needed. If
that ever changes, this file changes first.
