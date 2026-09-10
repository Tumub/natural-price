# Privacy

This file is the contract. If the code does something not described here,
that is a bug and should be reported as one.

## The short version

**The published build has no server at all.** The two server settings are
compiled out, so they do not appear in the options and no request can be
made whatever is in storage. Everything below about servers applies only to
a build someone makes with them switched on, or to a self-hoster.

Nothing leaves your browser. The extension
opens the page a second time in a private tab on your own device, reads the
price, compares the two here, and shows you the answer. No server is
involved, on any website.

A server is used only if you switch it on, and then only for the handful of
companies listed in the extension's options and in
[`SERVER_SITES`](packages/extension/src/settings.ts). Every other website
stays on your device whatever the setting.

[docs/anonymity.md](docs/anonymity.md) explains the mechanisms and where to
check them in the code.

## What each setting does

Only the first row exists in the published build.

| Setting | Leaves your browser | Websites |
|---|---|---|
| On this device only (default, and the only one published) | nothing | all |
| On this device and on the server | the fields below, for the listed companies only | all; only listed companies reach the server |
| On the server only | the fields below, for the listed companies only | listed companies only |

## The private tab

The extension opens the product page once more in a tab with no cookies, no
login and no history: an incognito window in Chrome, a temporary container
in Firefox. It reads the price with the same code, then closes the tab. The
shop sees one extra anonymous visit from your own address. The extension
reads nothing else from that tab and keeps nothing from it.

## What is sent in the server settings

The machine-readable version is [docs/payload-schema.json](docs/payload-schema.json).
The service rejects anything not in that schema.

| Field | Example | Why |
|---|---|---|
| `url` | `https://example.com/p/12345` | The page to fetch. Query string and fragment removed, except on Booking.com where the dates, guests, rooms and currency are kept because they define the price; the session id and tracking codes are dropped. |
| `productKey`, `productKeyType` | `4006381333931`, `gtin` | Identifies the product, read from the page. |
| `name` | `BILLY Bookcase` | Product name from the page. |
| `price`, `currency` | `129.00`, `EUR` | What you saw. |
| `country` | `CH` | Destination country **as shown on the page**, never derived from you. |
| `observedAt` | `2026-10-03T14:05:00Z` | Time-window matching. |
| `source`, `extractor` | `jsonld` | Which reader produced the price, so broken readers can be found. |
| `variantCount`, `priceRange` | `29` | Only on pages listing several variants. |
| `installId` | SHA-256 of a random identifier | Rate limiting. Not an account, not linked to you, regenerated if you reinstall. |
| `clientClean` | the same fields | The private tab's reading, when you use both. |

## What is never sent

- Cookies, login state, or anything from your session at the shop.
- Browsing history, other tabs, or pages that are not product pages.
- Your name, email, account, or any identifier that belongs to you.
- Anything at all, in the default setting.

## What the servers store

Only relevant if you switch a server setting on.

**Fetch service.** A rate-limit counter per hashed install identifier and
per hashed client address, expiring within 24 hours. One log line per
check: time, shop hostname, duration, fetch outcome, verdict. No address,
no identifier, no path, no query.

**Crowd database.** One row per install per product per hour:
`product_key`, `key_type`, shop hostname, `price`, `currency`, `country`,
the UTC hour, and an install hash. The install hash is the already-hashed
identifier hashed again with a salt that changes every day, so rows from
the same install cannot be linked across days. No URL path, no minute, no
address. Raw rows are deleted after **90 days**. Aggregates (count,
distinct installs, minimum, maximum, median) are published as an open
dataset under CC BY 4.0; see [docs/open-data.md](docs/open-data.md).

## Legal information

This section applies only to the hosted servers. In the default setting
there is no processing by anyone but you, on your own device.

- **Controller:** `[CONTROLLER NAME AND POSTAL ADDRESS — must be completed
  before the hosted service is offered to anyone else]`
- **Contact:** `[CONTACT EMAIL]`
- **Lawful basis:** consent (GDPR Article 6(1)(a)). The server is off by
  default; switching it on in the options is the consent, and switching it
  back to the device-only setting withdraws it, with no further processing
  from that moment.
- **Purposes:** comparing the price you were shown with a clean session and
  with an anonymous aggregate; rate limiting to keep the service available;
  aggregate statistics about how often shops block clean sessions.
- **Recipients:** the hosting provider, as a processor. No advertising, no
  analytics, no sale or sharing of data, no automated decisions with legal
  effects.
- **Location:** servers in Germany (EU). The operator is in Switzerland,
  which the European Commission recognises as providing adequate
  protection.
- **Retention:** rate-limit counters under 24 hours; service log lines as
  above; crowd rows 90 days; published aggregates indefinitely, as
  anonymous statistics.
- **Your rights:** access, rectification, erasure, restriction, objection,
  portability, and withdrawal of consent, plus the right to complain to a
  supervisory authority. Write to the contact address.
- **A limit worth being honest about:** the daily salt means we cannot tell
  which crowd rows came from you, and we will not ask you for extra
  information to make you identifiable. Where a controller cannot identify
  a person, GDPR Article 11 applies and the access, rectification,
  erasure and portability rights may not be exercisable on those rows. Your
  own device holds nothing but a random identifier and your settings;
  uninstalling removes them.

Swiss users: the Swiss Federal Act on Data Protection applies in parallel
and this notice is written to satisfy both.

## Uninstalling

Remove the extension. Your settings and the random identifier go with it.
Nothing remains on any server but anonymous counters and, if you used a
server setting, crowd rows that expire within 90 days.
