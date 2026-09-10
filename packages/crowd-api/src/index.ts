import { randomBytes } from 'node:crypto';
import { createCrowdApp } from './server';
import { CrowdStore } from './store';

const port = Number(process.env.PORT ?? 8788);
const dbPath = process.env.NP_CROWD_DB ?? 'crowd.sqlite';
const allowedHosts = (process.env.NP_ALLOWED_HOSTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
let secret = process.env.NP_CROWD_SECRET;
if (!secret) {
  secret = randomBytes(32).toString('hex');
  console.warn('NP_CROWD_SECRET not set: using a random secret; distinct-install counts reset on restart');
}
const store = new CrowdStore(dbPath, secret);
const app = createCrowdApp({ store, allowedHosts });
app.listen(port, () => console.log(`natural-price crowd-api on :${port}, db ${dbPath}, hosts: ${allowedHosts.join(', ') || 'any'}`));
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    app.close();
    store.close();
    process.exit(0);
  });
}
