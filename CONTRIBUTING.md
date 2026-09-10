# Contributing

Thanks for looking. The project is early, so the most useful thing you can
do is small and concrete.

## The best first contribution: a site extractor

Every site needs one file and one fixture.

1. Save the HTML of a real product page to
   `packages/extension/fixtures/<site>/<product>.html`. Strip anything
   personal from it first (your name, account, session ids in URLs).
2. Write `packages/extension/src/extractors/<site>.ts` implementing
   `extract(document, url)`. Return `null` when the page is not a product
   page.
3. Add a test that loads the fixture and asserts the price, currency and
   product key.
4. Open a pull request. CI runs the fixtures.

Use the "Add support for a site" issue template if you want to claim a site
before you start.

## Rules

- **No personal data in fixtures or tests.** Ever.
- **No bulk crawling.** The fetch service loads one page per user request.
  Pull requests that add crawling, scheduling of fetches without a user, or
  anything that looks like a scraper will be declined.
- **Keep the extension read-only.** It observes and reports. All comparison
  logic lives server side.
- **Broken selectors are normal.** When a site changes, update the fixture
  and the extractor together in one pull request.

## Development

Tooling will be TypeScript and Node. Exact setup lands in issue #1. Until
then, open an issue before writing code so nobody duplicates work.

## Licence

By contributing you agree your work is released under AGPL-3.0.
