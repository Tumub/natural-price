/**
 * Manual verification against the real launch sites. Fetches each page once
 * as "you" (plain anonymous request) and N times as a clean session, and
 * prints verdict, latency and fetch status per round. Run it before a
 * release and paste the summary into docs/verification-log.md.
 *
 *   npm run live-check -- [rounds]
 */
import { CleanFetcher } from '../src/browser';
import { compare } from '../src/compare';
import { extract } from '@natural-price/extension';
import { parseHtml } from '@natural-price/extension/src/dom';
import { fetchPage } from '@natural-price/extension/src/tools/fetch-page';

const urls = [
  'https://www.ikea.com/ch/en/p/billy-bookcase-white-00263850/',
  'https://www.mediamarkt.ch/de/product/_samsung-hw-s801d-soundbar-lautsprecher-weiss-154629028.html',
  'https://www.nike.com/ch/en/t/air-force-1-07-shoes-WrLlWX/CW2288-111',
];
const rounds = Number(process.argv[2] ?? 3);
const f = new CleanFetcher([{ label: 'direct' }], 2);
await f.start();
console.log(['host', 'round', 'ms', 'fetch', 'verdict', 'clean', 'yours', 'notes'].join('\t'));
let ok = 0, total = 0, falsePositives = 0;
for (const url of urls) {
  const page = await fetchPage(url);
  const yours = extract(parseHtml(page.html, page.finalUrl), new URL(page.finalUrl));
  if (!yours) {
    console.log(`${new URL(url).hostname}\t-\t-\thttp ${page.status}\tno price for "you"`);
    continue;
  }
  for (let i = 0; i < rounds; i++) {
    const t = Date.now();
    const cleans = await f.fetchMany(page.finalUrl.replace(/[?#].*$/, ''), 1);
    const r = compare({ ...yours, observedAt: new Date().toISOString() }, cleans);
    total++;
    if (r.comparable) ok++;
    // Same anonymous request on both sides: any "higher"/"lower" here is a false positive.
    if (r.verdict === 'higher' || r.verdict === 'lower') falsePositives++;
    console.log([new URL(url).hostname, i + 1, Date.now() - t, cleans.map((c) => c.status + (c.reason ? `(${c.reason})` : '')).join(','), r.verdict, r.clean?.price ?? '-', yours.price, r.reasons.filter((x) => !/assumed/.test(x)).join('; ')].join('\t'));
  }
}
await f.stop();
console.log(`\nsummary: ${ok}/${total} comparable, ${falsePositives} false positive(s)`);
