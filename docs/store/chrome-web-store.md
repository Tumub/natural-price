# Chrome Web Store listing

Copy for the developer dashboard. Keep it in step with PRIVACY.md.

## Name

Natural Price

## Summary (132 characters max)

See the price a stranger would get, next to the price you were shown. Detects personalised pricing.

## Description

Shops, airlines and hotel platforms can show different people different
prices. You cannot see it happening. Natural Price reads the price on the
product page you are looking at, has a server load the same page in a
fresh anonymous session, and shows both side by side with a confidence
level. When other people using the extension have seen the same product,
it tells you what they saw too.

It works on a growing list of sites. It sends nothing that identifies you:
the page address without tracking parameters, the price, the currency, the
destination country the page shows, the time, and a hashed random install
id. The exact schema is published and the server rejects anything else.

It does not hide you, block anything, or change what a site does. It shows
you what was observed, and when a lower price exists it opens the page in a
private window so you can compare before you buy.

Open source under AGPL-3.0. Run your own server if you prefer.

## Category

Shopping

## Single purpose

Compare the price shown to the user with the price shown to an anonymous
session and to other users, on supported shopping sites.

## Permission justifications

| Permission | Why |
|---|---|
| `storage` | Keeps the random install id and the service URL the user chose |
| `clipboardWrite` | Copies the page link when Chrome will not open a private window for the extension |
| Host permission for the service origin | The background worker posts the observation to the fetch service |
| Content scripts on supported shops | Reading the price from the product page |
| Optional host permissions | Only if the user points the extension at their own server |

## Privacy practices form

- Collects: website content (the price and product identifiers on the page
  the user is viewing). No personal communications, no location, no
  authentication information, no personal identifiers, no web history.
- Use: only for the extension's single purpose. Not sold, not used for
  unrelated purposes, not used for creditworthiness or lending.
- Remote code: none.
- Privacy policy URL: the PRIVACY.md in the repository, rendered on the
  project site.

## Assets

- 128 px icon (to be designed; the badge's black-on-white wordmark scaled)
- Screenshots 1280×800: badge "same" on IKEA, badge "higher" with the
  button, the options page, the Details list expanded
- Promo tile 440×280 optional

## Before submitting

- Phase 3 exit metrics met (docs/beta/README.md)
- `NP_SERVICE_URL` repository variable points at the production service
- Version bumped, tag pushed, zip downloaded from the release
