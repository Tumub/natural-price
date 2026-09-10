# Deploy

**Production, since 2026-09-10:** `https://your-server.example` on the Coolify
host, project `natural-price`, apps `natural-price-fetch` (1 GB cap, one
browser context, exit `de`) and `natural-price-crowd` (128 MB cap, volume
`/data`). The crowd API has no public route; the fetch service reaches it
as `http://natural-price-crowd:8788`. Redeploy with `deploy/coolify.sh`
using the same variables. Release zips are built against this origin.

One VPS with 2 GB of memory, Docker, and a domain pointing at it. Both
services, plus Caddy for automatic TLS, in one `docker compose up`.

## First time

1. On the host: install Docker with the compose plugin, open ports 80 and
   443, point `api.yourdomain` at the host's IP.
2. Locally: `cp deploy/.env.example deploy/.env`, set `NP_DOMAIN`, and set
   `NP_CROWD_SECRET` to `openssl rand -hex 32`. The file stays local and is
   copied to the host; it is git-ignored.
3. `deploy/deploy.sh root@host`. It rsyncs the repository, builds both
   images on the host, starts everything, and waits for `/health` over TLS.
4. Set the GitHub repository variable `NP_SERVICE_URL` to
   `https://api.yourdomain` and push a `v*` tag. The release zips are built
   against that origin.

## Every update

`deploy/deploy.sh root@host` again. Data volumes survive rebuilds.

## Routes on the public domain

| Path | Service |
|---|---|
| `/check`, `/fetch`, `/health`, `/stats` | fetch service |
| `/crowd/health`, `/crowd/aggregate`, `/crowd/export/<day>` | crowd API |

The crowd API's `/observe` is reachable only from the fetch service on the
internal network; the extension never calls it directly.

## Operations

```bash
ssh root@host 'cd /opt/natural-price/deploy && docker compose logs -f --tail 100'
ssh root@host 'cd /opt/natural-price/deploy && docker compose ps'
# back up the crowd database
ssh root@host 'docker run --rm -v natural-price_crowd-data:/d -v /root:/out alpine cp /d/crowd.sqlite /out/crowd-$(date +%F).sqlite'
```

Memory: the fetch service is capped at 1.5 GB and the crowd API at 256 MB.
Two concurrent clean fetches fit in that. Raise `NP_CONCURRENCY` only with
more memory.

## Coolify

If the host runs [Coolify](https://coolify.io), skip Caddy and compose:
`deploy/coolify.sh` creates both services as Coolify applications built
from this public repository, gives the crowd API a persistent volume,
joins both to Coolify's network so the fetch service reaches the crowd API
internally, sets the variables, and deploys. Coolify's Traefik provides
TLS for the fetch service's domain.

```bash
export COOLIFY_API_URL=https://coolify.example/api/v1
export COOLIFY_API_TOKEN=...            # from Coolify: Keys & Tokens, API tokens; needs write scope
export NP_DOMAIN=api.naturalprice.example   # A record already pointing at the Coolify host, DNS-only if behind Cloudflare
deploy/coolify.sh                       # idempotent: re-running updates and redeploys
```

The token is read from the environment only. Never put it in this
repository. `deploy/coolify.sh --dry-run` prints every request it would
make without sending any.

Optional: `NP_SERVER_UUID` picks the Coolify server, `NP_FETCH_MEMORY`,
`NP_CROWD_MEMORY` and `NP_CONCURRENCY` size the containers. On a shared
host use `NP_FETCH_MEMORY=1024M NP_CROWD_MEMORY=128M NP_CONCURRENCY=1`.

Coolify 4.0.0 notes, learned the hard way: Dockerfile paths must start
with `/`; project descriptions may not contain a colon; the fields
`custom_internal_name`, `is_consistent_container_name_enabled` and
`docker_images_to_keep` are rejected at creation and applied as a
best-effort update; the storages listing is `{persistent_storages,
file_storages}`; env vars are updated by key, not uuid; the repository
must be given as `owner/repo`, a full URL gets the host prepended twice on
update. Health checks run curl inside the container, so every image ships
curl. When the internal name is refused, the fetch service addresses the
crowd API by its network alias.

## Elsewhere

Any host that runs Docker works the same way. On Fly.io or Railway, deploy
each package's Dockerfile as its own app, give the crowd app a volume at
`/data`, set the same environment variables, and point `NP_CROWD_URL` at the
crowd app's internal address.
