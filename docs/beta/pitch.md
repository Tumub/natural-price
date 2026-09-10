# Recruiting testers

## The paragraph

> Shops, airlines and hotel sites show different people different prices.
> It is called surveillance pricing, and you cannot see it happening.
> Natural Price is a small open-source Chrome extension that reads the price
> you were shown and compares it with the same page opened in a private tab
> on your own machine. It works on any shop that publishes a price, it sends
> nothing anywhere because there is no server, and the whole thing is on
> GitHub. I am looking for fifty people to run it for a month and tell me
> what it finds. Five minutes to install, no account.

## Channels, in order

1. **Personal network first.** Ten people who will actually reply. Ask them
   directly, one message each.
2. **Privacy and consumer-rights communities.** r/privacy, r/degoogle, the
   Fediverse privacy crowd, Swiss and German consumer forums. Post once,
   answer every question, do not repost.
3. **Show HN.** After the first ten testers have run it for a week, so the
   post can lead with a real number. Draft below.
4. **Journalists covering personalised pricing.** Only after Show HN, and
   only with the aggregate numbers from the weekly summary.

## Show HN draft

Title: Show HN: See the price a stranger gets, without sending anything anywhere

Alternative title, if surveillance pricing is in the news that week:
Show HN: A surveillance-pricing detector that works entirely on your machine

Body:

> Personalised pricing is legal in the EU as long as the shop tells you,
> and almost none of them do. I built a Chrome extension that reads the
> price on the product page, has a server load the same page in a fresh
> anonymous session, and shows both side by side with a confidence level.
>
> After one week with N testers on three sites: X checks, Y percent of
> clean fetches succeeded, Z differences found (details in the repo).
>
> Everything is AGPL. The extension sends the page URL, the price, the
> currency and a hashed install id, nothing else; the schema is in the repo
> and the server rejects anything outside it. I would like fifty more
> testers and, more than that, site extractors: one file, one saved page,
> one test.

## What not to promise

- That it catches every case. It catches what a single clean session can
  see. The crowd baseline comes later.
- That "different" means "discriminated". The badge never says that, and
  neither should the pitch.
