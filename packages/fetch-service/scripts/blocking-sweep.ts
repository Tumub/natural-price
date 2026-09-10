/**
 * Which sites answer a clean-room fetch from this connection? One product
 * page per site, one fetch each, direct connection unless NP_EXITS is set.
 * Paste the table into docs/blocking-log.md with the date and exit used.
 *
 *   npm run blocking-sweep
 */
import { CleanFetcher, exitsFromEnv } from '../src/browser';

const sites: [string, string][] = [
  ['ikea.com/ch', 'https://www.ikea.com/ch/en/p/billy-bookcase-white-00263850/'],
  ['mediamarkt.ch', 'https://www.mediamarkt.ch/de/product/_samsung-hw-s801d-soundbar-lautsprecher-weiss-154629028.html'],
  ['nike.com/ch', 'https://www.nike.com/ch/en/t/air-force-1-07-shoes-WrLlWX/CW2288-111'],
  ['galaxus.ch', 'https://www.galaxus.ch/en/s1/product/apple-iphone-16-128-gb-black-680-sim-esim-48-mpx-5g-smartphones-48856011'],
  ['decathlon.ch', 'https://www.decathlon.ch/en/p/mp/quechua/quechua-mh100-hiking-backpack-10-l/_/R-p-9e0c0a5a-8c3a-4b0e-8c8a-4a0e2e9b8a4b'],
  ['bol.com', 'https://www.bol.com/nl/nl/p/lego-classic-creatieve-stenen-11029/9300000097011533/'],
  ['zalando.ch', 'https://www.zalando.ch/en/nike-sportswear-air-force-1-07-trainers-white-ni112o0bt-a11.html'],
  ['conrad.ch', 'https://www.conrad.ch/de/p/raspberry-pi-4-b-8-gb-4-x-1-5-ghz-raspberry-pi-2268902.html'],
  ['lego.com', 'https://www.lego.com/en-ch/product/eiffel-tower-10307'],
  ['hm.com', 'https://www2.hm.com/en_gb/productpage.1227154001.html'],
  ['uniqlo.com', 'https://www.uniqlo.com/eu/en/product/heattech-crew-neck-long-sleeve-t-shirt-extra-warm-455263.html'],
  ['booking.com', 'https://www.booking.com/hotel/ch/schweizerhof-bern.en-gb.html'],
  ['digitec.ch', 'https://www.digitec.ch/en/s1/product/apple-iphone-16-128-gb-black-680-sim-esim-48-mpx-5g-smartphones-48856011'],
  ['brack.ch', 'https://www.brack.ch/apple-iphone-16-128gb-schwarz-1730458'],
];

const f = new CleanFetcher(exitsFromEnv(), 2, 25_000);
await f.start();
console.log(['site', 'exit', 'ms', 'status', 'reason', 'price'].join('\t'));
let ok = 0;
for (const [site, url] of sites) {
  const t = Date.now();
  const [r] = await f.fetchMany(url, 1);
  if (r!.status === 'ok') ok++;
  console.log([site, r!.exitLocation, Date.now() - t, r!.status, r!.reason ?? '', r!.observation ? `${r!.observation.price} ${r!.observation.currency}` : ''].join('\t'));
}
await f.stop();
console.log(`\n${ok}/${sites.length} sites returned a price`);
