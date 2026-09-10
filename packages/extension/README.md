# extension

Browser extension, Manifest V3. Reads the price on a product page, asks the
fetch service what a clean session sees, shows a badge.

- `src/extractors/` price readers. `jsonld.ts` is generic; site files go
  next to it and are registered in `index.ts`.
- `src/content.ts` runs on the launch sites, reads, asks, renders.
- `src/background.ts` the only network call, to the fetch service.
- `src/badge.ts` the panel, in a shadow root.
- `src/install-id.ts` random id, hashed before it leaves the browser.
- `fixtures/` real pages, scripts stripped, with expected values.
- `build.mjs` bundles to `dist/`. `NP_SERVICE_URL` sets the service origin
  that goes into `host_permissions`.

Load unpacked from `dist/` after `npm run build:extension`. The options page
lets you point it at another fetch service.

Phase 2 done. Store packaging is issue #12, Firefox build is phase 4.
