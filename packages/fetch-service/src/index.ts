import { RateLimiter } from '@natural-price/shared';
import { CleanFetcher, exitsFromEnv } from './browser';
import { Breaker } from './breaker';
import { CrowdClient } from './crowd';
import { createApp } from './server';
import { Stats } from './stats';

const port = Number(process.env.PORT ?? 8787);
const allowedHosts = (process.env.NP_ALLOWED_HOSTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const fetcher = new CleanFetcher(exitsFromEnv(), Number(process.env.NP_CONCURRENCY ?? 2));
const limiter = new RateLimiter(Number(process.env.NP_PER_MINUTE ?? 10), Number(process.env.NP_PER_DAY ?? 100));

const stats = new Stats();
const statsFile = process.env.NP_STATS_FILE;
if (statsFile) stats.load(statsFile);
const breaker = new Breaker(Number(process.env.NP_BREAK_AFTER ?? 3), 10 * 60_000, Number(process.env.NP_BREAK_MINUTES ?? 15) * 60_000);

await fetcher.start();
const crowd = process.env.NP_CROWD_URL ? new CrowdClient(process.env.NP_CROWD_URL) : undefined;
const app = createApp({ fetcher, limiter, allowedHosts, fetchesPerCheck: Number(process.env.NP_FETCHES_PER_CHECK ?? 2), breaker, stats, crowd });
app.listen(port, () => console.log(`natural-price fetch-service on :${port}, exits: ${fetcher.exitLabels.join(', ')}, hosts: ${allowedHosts.join(', ') || 'any'}, crowd: ${process.env.NP_CROWD_URL ?? 'off'}`));
setInterval(() => limiter.sweep(), 60 * 60 * 1000).unref();
if (statsFile) setInterval(() => stats.save(statsFile), 60 * 1000).unref();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    app.close();
    if (statsFile) stats.save(statsFile);
    await fetcher.stop();
    process.exit(0);
  });
}
