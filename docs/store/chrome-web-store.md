# Chrome Web Store listing

Copy for the developer dashboard. Keep it in step with PRIVACY.md.

## Name

Natural Price

## Summary (132 characters max)

See the price a stranger would get, next to the price you were shown. Detects personalised pricing.

## Description

Shops, airlines and hotel platforms can show different people different
prices. You cannot see it happening. Natural Price reads the price on the
product page you are looking at, opens the same page again in a private tab
on your own device, and shows both side by side with a confidence level.

By default nothing leaves your browser. There is no account, no tracking
and no server: the second reading and the comparison both happen on your
machine. If you choose to, you can also turn on a shared server for four
named shops, which adds a second opinion from a different address and an
anonymous comparison with other users. That setting is off until you switch
it on, the shops it covers are listed in the options, and the exact fields
sent are published in the repository.

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
| `storage` | Keeps the user's settings and a random identifier used for rate limiting |
| `clipboardWrite` | Copies the page link when Chrome will not open a private window for the extension |
| `incognito: spanning` and windows | Opening the private tab that provides the clean price, then closing it |
| Host access to all websites | The price reader runs on the page the user is viewing. It reads only the price and product identifiers, and in the default setting the result never leaves the browser. All-sites access is what lets the extension work on any shop rather than a fixed list. |

**Reviewer note.** Broad host access here is for reading, not sending. The
default setting performs the entire comparison locally and makes no network
request. The optional server setting is limited in code to four named
hosts (`SERVER_SITES` in `packages/extension/src/settings.ts`).

## Privacy practices form

- Collects: nothing by default. With the optional server setting on, website
  content (the price and product identifiers on the page being viewed) for
  four named shops. No personal communications, no location, no
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
