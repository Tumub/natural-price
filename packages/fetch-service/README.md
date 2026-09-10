# fetch-service

Clean-room fetch API. Loads one URL in a fresh Playwright context with no
cookies, a generic user agent and a chosen exit location, runs the same
extractor the extension uses, and compares the result with what the user
saw. Rules: [docs/comparison-rules.md](../../docs/comparison-rules.md).

## Run locally

```bash
npm install
npx playwright install chromium
NP_ALLOWED_HOSTS=ikea.com,mediamarkt.ch,nike.com npm run service
```

`POST /check` with `{ observation, installId }` returns a comparison.
`POST /fetch` with `{ url }` returns the raw clean fetches, useful when a
site misbehaves. `GET /health` lists the configured exits.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8787 | Listen port |
| `NP_ALLOWED_HOSTS` | any | Comma list of hosts the service will fetch. Set it in production. |
| `NP_EXITS` | `direct` | `label=proxy-url;label=proxy-url`. A label with no URL means the server's own connection. Two or more exits enable medium confidence. |
| `NP_FETCHES_PER_CHECK` | 2 | Distinct exits used per check |
| `NP_CONCURRENCY` | 2 | Parallel browser contexts |
| `NP_PER_MINUTE`, `NP_PER_DAY` | 10, 100 | Rate limit per hashed install id |

## Deploy

Build the image from the repository root, since it needs the extension
package for the extractor:

```bash
docker build -f packages/fetch-service/Dockerfile -t natural-price-fetch .
docker run -p 8787:8787 -e NP_ALLOWED_HOSTS=ikea.com,mediamarkt.ch,nike.com natural-price-fetch
```

A 2 GB VPS runs it comfortably at phase 2 load. Put it behind a reverse proxy
with TLS; the extension's manifest must list the public origin.

## What is logged

One JSON line per check: time, hostname, duration, fetch statuses, verdict.
No IP, no install id, no path, no query. Proxy credentials come from the
environment and are never printed.
