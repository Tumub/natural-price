# Firefox Add-ons (AMO) listing

Build: `npm run build:extension:firefox` then `npm run package:firefox`.
The manifest differs from Chrome in two ways, both applied by the build:
the background runs as an event page (`background.scripts`), and
`browser_specific_settings.gecko` carries the add-on id and minimum version
128.

## Behaviour differences to know

- Firefox treats host permissions as optional. The fetch service answers
  with permissive CORS, so the background call works without a grant. If
  the site access prompt appears, "Always allow" is the right answer.
- Opening a private window from an extension needs the user to allow the
  add-on in private windows; the badge falls back to copying the link.

## Listing

Name, summary and description: same as [chrome-web-store.md](chrome-web-store.md).

Categories: Shopping, Privacy & Security.

Licence: GNU Affero General Public License v3.0.

Source code submission: AMO requires the source when the upload is
minified. Attach the repository tarball at the tag, with build
instructions pointing at `npm run build:extension:firefox`. The reviewer
must be able to reproduce `dist-firefox/` byte for byte, so pin Node 22 in
the notes.

Privacy policy: paste PRIVACY.md.

Data collection disclosure: "Collects website content (prices and product
identifiers on pages you view) and sends it to the configured server. Does
not collect personal data."

## Before submitting

Same checklist as the Chrome listing. Test the packaged zip with
`about:debugging` "Load Temporary Add-on" on the three launch sites first.
