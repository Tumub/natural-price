# crowd-api

The baseline that cannot be blocked. Stores anonymous observations and
answers "what did other people see for this product this hour, and today".
Aggregation is the SQL in [docs/crowd-aggregation.sql](../../docs/crowd-aggregation.sql).

The extension never calls this directly. The fetch service forwards each
observation server to server (`NP_CROWD_URL`) and merges the answer into
its comparison. See [PRIVACY.md](../../PRIVACY.md).

## Run locally

```bash
NP_CROWD_SECRET=$(openssl rand -hex 32) npm run crowd
```

## Routes

| Route | Does |
|---|---|
| `POST /observe` | Store one observation, answer with hour and day aggregates |
| `GET /aggregate?productKey=&currency=&country=` | Read only |
| `GET /export/YYYY-MM-DD` | Open dataset for the day, CC BY 4.0 |
| `GET /health` | Row count |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8788 | Listen port |
| `NP_CROWD_DB` | `crowd.sqlite` | SQLite file. Mount a volume in Docker. |
| `NP_CROWD_SECRET` | random | Seeds the daily install-hash salt. Set it, or install counts reset on restart. |
| `NP_ALLOWED_HOSTS` | any | Hostnames accepted, suffix match |

## What is stored

`product_key, key_type, host, price, currency, country, hour, install_hash`.
No URL, no path, no minute, no IP. One row per install per product per
hour; a repeat replaces the earlier row. Install hashes are salted per day
and cannot be joined across days.

## Deploy

```bash
docker build -f packages/crowd-api/Dockerfile -t natural-price-crowd .
docker run -p 8788:8788 -v crowd-data:/data -e NP_CROWD_SECRET=... natural-price-crowd
```

Back up `/data/crowd.sqlite`. Publish `GET /export/<day>` weekly as the open
dataset (see [docs/open-data.md](../../docs/open-data.md)).
