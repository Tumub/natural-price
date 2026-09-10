# Blocking log and exit strategy

What each site does when the fetch service loads one product page in a
clean session. Updated by running `npm run blocking-sweep` and pasting the
table. Newest first.

## Strategy

1. **Full Chromium, not the headless shell**, with a user agent that matches
   its real version, the `webdriver` flag removed, and locale, timezone and
   Accept-Language matching the exit's country. This alone moved Conrad and
   LEGO from 403 to a price.
2. **Circuit breaker per host.** Three blocked fetches in ten minutes pause
   the host for fifteen. Paused hosts answer instantly with "blocked" and
   cost nothing.
3. **Residential exits only where needed.** Add them per country through
   `NP_EXITS`, name each exit after its country so the profile matches, and
   rerun the sweep. Record cost per successful fetch here. Needs a proxy
   account, which is issue #9's remaining work.
4. **Do not escalate past that.** No CAPTCHA solving, no fingerprint
   spoofing beyond a consistent profile. A site that still blocks a single
   clean page load per user request is a site for the crowd baseline.

## 2026-09-10, production: Hetzner Falkenstein datacenter address, exit `de`

First checks through the deployed service at `np.orcavera.com`.

| Site | Result | Note |
|---|---|---|
| ikea.com/ch | price | 1.7 s |
| nike.com/ch | price | 2.0 s |
| mediamarkt.ch | 403 | answers a residential Swiss address the same day; blocks the datacenter address |

MediaMarkt is the first launch site that needs either a residential exit
(issue #9) or the crowd baseline. Until then its badge says the site
refused the clean fetch.

## 2026-09-10, direct connection from Switzerland, no proxy

Full Chromium new headless, one fetch per site.

| Site | Result | Time | Note |
|---|---|---|---|
| ikea.com/ch | price | ~0.9 s | launch site |
| mediamarkt.ch | price | ~1.2 s | launch site |
| nike.com/ch | price | 0.9 s | launch site |
| conrad.ch | price | 3.0 s | 403 to plain requests; answers Chromium |
| lego.com | price | 2.0 s | 403 to plain requests; answers Chromium |
| brack.ch | price | 11.1 s | slow, and the test URL was stale; recheck with a live product |
| decathlon.ch | 403 | 1.7 s | |
| bol.com | 403 | 0.7 s | |
| zalando.ch | 403 | 11.0 s | slow block |
| hm.com | 403 | 0.7 s | |
| galaxus.ch | connection reset | 0.1 s | HTTP/2 protocol error, likely TLS-level bot detection |
| digitec.ch | connection reset | 0.1 s | same operator as Galaxus |
| uniqlo.com | no price | 3.1 s | 200 but no JSON-LD; needs a DOM extractor |
| booking.com | no price | 8.6 s | HTTP 202 JavaScript challenge page |

6 of 14 returned a price. Candidates to add as launch sites without any
proxy: conrad.ch, lego.com. Candidates for a residential exit trial:
decathlon, bol, zalando, hm. Galaxus and Digitec probably need the crowd
baseline. Booking needs both a challenge-capable session and a hotel
extractor; it stays in phase 3 scope only if a proxy trial happens.
