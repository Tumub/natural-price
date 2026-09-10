# How nobody is identified

Written for a reader who wants to check the claim rather than take it on
trust. Every mechanism below is in the code and in the tests; the file
names are given so you can read them.

## The short answer

In the published build there is no server, so there is no one to identify
you to. The extension reads the price on the page you are already looking
at, opens that page again in a private tab on your own machine, compares
the two, and shows you the answer. Nothing is transmitted. An end-to-end
test points the extension at a listener that counts requests, tells it to
use a server anyway, and asserts the count is zero
(`packages/extension/test/no-server.e2e.test.ts`).

Under GDPR this matters more than any promise: what a person does on their
own device for their own purposes is not processing carried out by us, and
the household exemption in Article 2(2)(c) covers the user's side. There is
no controller, no processor, no transfer and no retention, because there is
no data.

## What the extension holds on your device

| Kept | Why | Where |
|---|---|---|
| Your settings | so the extension behaves as you chose | `chrome.storage.local` |
| A random identifier | rate limiting, only if a server is ever enabled | `chrome.storage.local` |

The identifier is a random value with no relationship to you, your browser
profile, your account at any shop or your hardware. It is generated on
install (`src/install-id.ts`), never shown to a website, and destroyed when
you uninstall. Nothing else is stored: no history, no page contents, no
list of what you looked at.

## What the private tab does and does not reveal

The private tab is a real visit to the shop from your own connection. The
shop therefore sees one extra anonymous visit: your address, and nothing
else, because the tab carries no cookies, no login and no history. That is
the same footprint as opening an incognito window yourself.

The extension reads only the price and the product identifiers from that
tab, then closes it. It does not read the page for anything else and keeps
nothing from it.

## If a server is ever switched on

Only a build made with the server compiled in can do this, and then only
for four named shops listed in the options page and fixed in
`src/settings.ts`. Four defences apply, in layers.

**Nothing about you is in the payload.** The fields are listed in
`docs/payload-schema.json` and the server rejects anything else, tested in
`packages/shared/test/validate.test.ts`. There is no name, no email, no
account, no cookie, no device profile, no browsing history. The destination
country comes from the shop's own page, never from your address.

**The URL is stripped before it is sent.** Query strings and fragments go,
which removes session identifiers and tracking codes. The one exception is
Booking.com, where the dates and guest counts define the price and are
kept; the session id and the tracking codes are still dropped
(`src/extractors/booking.ts`, tested).

**The identifier is hashed before it leaves, then hashed again with a salt
that changes every day.** The server never sees the raw value. Because
today's salt and yesterday's differ, the same install produces unrelated
values on two days, so no one can follow an install through the database
over time, including us. Tested in `packages/crowd-api/test/store.test.ts`.

**Only aggregates survive.** One row per install per product per hour; a
second look in the same hour replaces the first, so nobody moves a median
alone. Raw rows are deleted after ninety days by a job that runs every six
hours. What is published is a count, a distinct-install count, a minimum, a
maximum and a median per product per hour, with no path, no minute and no
identifier. The SQL that produces them is in `docs/crowd-aggregation.sql`
so the claim can be checked rather than believed.

## The honest limits

- **Your address reaches the server as it reaches any web server.** It is
  used to rate limit, hashed for that purpose, and never written to the
  application log. The reverse proxy in front of it may keep its own access
  log; that is listed as an open item in [compliance.md](compliance.md).
- **Anonymisation this strong costs you rights.** Because the daily salt
  makes your rows unattributable, we cannot find them to show you or delete
  them, and we will not collect more information about you in order to be
  able to. GDPR Article 11 covers exactly this situation, and
  [PRIVACY.md](../PRIVACY.md) says so plainly rather than pretending
  otherwise.
- **A price is not personal data, but a browsing pattern can be.** That is
  why the hourly bucket, the per-install-per-hour limit and the ninety-day
  deletion exist: to stop a sequence of observations from becoming a
  picture of one person's shopping.
