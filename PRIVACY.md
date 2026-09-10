# Privacy

This file is the contract. If the code sends something that is not listed
here, that is a bug and should be reported as one.

## What the extension sends to the fetch service

| Field | Example | Why |
|---|---|---|
| `url` | `https://example.com/p/12345` | The page to fetch. Query strings and fragments are removed before sending. |
| `price` | `129.00` | What you saw. |
| `currency` | `EUR` | To compare like with like. |
| `country` | `CH` | Destination country as shown on the page, not your IP. Needed because prices legitimately differ by destination. |
| `observed_at` | `2026-10-03T14:05:00Z` | Time window matching. |
| `install_id` | random UUID hashed | Rate limiting only. Not linked to any account. Regenerated if you reinstall. |

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

- Fetch service: nothing beyond a rate-limit counter per hashed install id,
  expiring after 24 hours.
- Crowd API: the anonymised observations above, kept indefinitely, published
  in aggregate.

## Legal basis

The project is run from Switzerland and serves EU users. The Swiss Federal
Act on Data Protection and the GDPR apply. The design goal is that no
personal data is processed at all, so that no consent flow is needed. If
that ever changes, this file changes first.
