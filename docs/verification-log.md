# Verification log

Manual checks against the real launch sites, newest first. Run with
`npm run live-check -- <rounds>`. "You" and the clean session are both
anonymous requests here, so any verdict other than `same` is a false
positive of the pipeline, not a finding about the site.

## 2026-09-10, phase 2 exit check

Direct connection from Switzerland, no proxy, headless Chromium, 5 rounds
per site.

| Site | Rounds | Clean fetch ok | Verdict | Latency |
|---|---|---|---|---|
| ikea.com/ch | 5 | 5 | same ×5 | 0.84 to 0.98 s |
| mediamarkt.ch | 5 | 5 | same ×5 | 0.99 to 2.16 s |
| nike.com/ch | 5 | 5 | same ×5 | 0.57 to 0.79 s |

15 of 15 comparable, 0 false positives. Well under the 5 second badge
target. The plan's 50-check target is not met yet; 15 was chosen to avoid
hammering the sites from one address in one minute.

Blocked in the fixture hunt the same day (plain anonymous fetch): galaxus.ch,
decathlon.ch, bol.com, zalando.ch, conrad.ch, lego.com, hm.com. See
[launch-sites.md](launch-sites.md).
