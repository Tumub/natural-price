# Contributing

Thanks for looking. The project is early, so the most useful thing you can
do is small and concrete.

## The best first contribution: a site extractor

Every site needs one file and one fixture.

1. Save the page as a fixture:
   `npm run add-fixture -- <product-url> <site> <name>`. This fetches the page
   with no cookies, strips every script that is not JSON-LD, and writes
   `fixtures/<site>/<name>.html` plus `<name>.expected.json` under
   `packages/extension/`. If the site blocks anonymous fetches, save the page
   from your browser, strip scripts yourself, and check it for anything
   personal before committing.
2. If the generic JSON-LD extractor already found the right price, check the
   expected values by eye and you are done. Open the pull request.
3. Otherwise write `packages/extension/src/extractors/<site>.ts` implementing
   the `Extractor` interface in `src/types.ts`, register it in
   `src/extractors/index.ts`, and fill in `expected.json`. Return `null` when
   the page is not a product page.
4. `npm test` runs every fixture. CI runs the same on your pull request.

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

```bash
npm install
npm run typecheck
npm test
npm run demo -- <url-or-fixture.html>
```

TypeScript, Vitest, jsdom. Node 20 or newer. Open an issue before starting
anything bigger than an extractor so nobody duplicates work.

## Licence

By contributing you agree your work is released under AGPL-3.0.
