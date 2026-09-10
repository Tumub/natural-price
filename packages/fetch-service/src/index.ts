import { CleanFetcher, exitsFromEnv } from './browser';
import { RateLimiter } from './ratelimit';
import { createApp } from './server';

const port = Number(process.env.PORT ?? 8787);
const allowedHosts = (process.env.NP_ALLOWED_HOSTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const fetcher = new CleanFetcher(exitsFromEnv(), Number(process.env.NP_CONCURRENCY ?? 2));
const limiter = new RateLimiter(Number(process.env.NP_PER_MINUTE ?? 10), Number(process.env.NP_PER_DAY ?? 100));

await fetcher.start();
const app = createApp({ fetcher, limiter, allowedHosts, fetchesPerCheck: Number(process.env.NP_FETCHES_PER_CHECK ?? 2) });
app.listen(port, () => console.log(`natural-price fetch-service on :${port}, exits: ${fetcher.exitLabels.join(', ')}, hosts: ${allowedHosts.join(', ') || 'any'}`));
setInterval(() => limiter.sweep(), 60 * 60 * 1000).unref();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    app.close();
    await fetcher.stop();
    process.exit(0);
  });
}
