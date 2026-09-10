# fetch-service

Clean-room fetch API. Loads one URL in a fresh Playwright context with no
cookies, a generic user agent and a chosen exit location, runs the same
extractor the extension uses, and compares the result with what the user
saw. Rules: [docs/comparison-rules.md](../../docs/comparison-rules.md).

## Run locally

```bash
npm install
npx playwright install chromium
NP_ALLOWED_HOSTS=ikea.com,mediamarkt.ch,nike.com,booking.com npm run service
```

`POST /check` with `{ observation, installId }` returns a comparison. The
body is validated against `docs/payload-schema.json`; anything extra is
rejected. `POST /fetch` with `{ url }` returns the raw clean fetches, useful
when a site misbehaves. `GET /health` lists the configured exits and any
paused hosts. `GET /stats` returns per-host per-day counters: checks,
fetch statuses and verdicts. No ids, no URLs, no prices.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8787 | Listen port |
| `NP_ALLOWED_HOSTS` | any | Comma list of hosts the service will fetch. Set it in production. |
| `NP_EXITS` | `direct` | `label=proxy-url;label=proxy-url`. A label with no URL means the server's own connection. Two or more exits enable medium confidence. |
| `NP_FETCHES_PER_CHECK` | 2 | Distinct exits used per check |
| `NP_CONCURRENCY` | 2 | Parallel browser contexts |
| `NP_PER_MINUTE`, `NP_PER_DAY` | 10, 100 | Rate limit per hashed install id |
| `NP_BREAK_AFTER`, `NP_BREAK_MINUTES` | 3, 15 | Pause a host after N blocked fetches in 10 minutes, for M minutes |
| `NP_STATS_FILE` | unset | Persist the counters to this JSON file every minute |
| `NP_CROWD_URL` | unset | Crowd API origin. Each validated observation is forwarded there and the answer merged into the comparison. |

Exit labels double as country profiles: an exit called `ch` browses with a
Swiss locale, timezone and Accept-Language. `direct` is neutral. Name the
direct connection after its country (`NP_EXITS=ch`) when the server sits
there.

## Deploy

Build the image from the repository root, since it needs the extension
package for the extractor:

```bash
docker build -f packages/fetch-service/Dockerfile -t natural-price-fetch .
docker run -p 8787:8787 -e NP_ALLOWED_HOSTS=ikea.com,mediamarkt.ch,nike.com,booking.com natural-price-fetch
```

A 2 GB VPS runs it comfortably at phase 2 load. Put it behind a reverse proxy
with TLS; the extension's manifest must list the public origin.

## What is logged

One JSON line per check: time, hostname, duration, fetch statuses, verdict.
No IP, no install id, no path, no query. Proxy credentials come from the
environment and are never printed.
