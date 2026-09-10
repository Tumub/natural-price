import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type { Observation } from '@natural-price/extension';

// Loaded through require so that Vite's import analysis, which does not yet
// know node:sqlite, leaves it alone. Plain Node and tsx resolve it directly.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof DatabaseSyncType };

/**
 * Append-only anonymous observations and their aggregates. One row per
 * install per product per hour: a second observation from the same install
 * in the same hour replaces the first, so nobody can move a median alone.
 *
 * install_hash = sha256(installId + daily salt), where the daily salt is
 * derived from a server secret and the UTC date. The same install gets a
 * different hash every day, so rows cannot be joined across days.
 */

export interface Aggregate {
  window: 'hour' | 'day';
  bucket: string;
  n: number;
  installs: number;
  median: number;
  min: number;
  max: number;
}

export interface CrowdAnswer {
  hour: Aggregate | null;
  day: Aggregate | null;
}

const AGG_SQL = readFileSync(join(import.meta.dirname, '..', '..', '..', 'docs', 'crowd-aggregation.sql'), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

export class CrowdStore {
  private db: DatabaseSyncType;
  private insert;
  private agg;

  constructor(path: string, private secret: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS observations (
        product_key  TEXT NOT NULL,
        key_type     TEXT NOT NULL,
        host         TEXT NOT NULL,
        price        REAL NOT NULL,
        currency     TEXT NOT NULL,
        country      TEXT NOT NULL DEFAULT '',
        hour         TEXT NOT NULL,
        install_hash TEXT NOT NULL,
        PRIMARY KEY (product_key, currency, country, hour, install_hash)
      ) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS obs_hour ON observations (hour);
    `);
    this.insert = this.db.prepare(
      `INSERT OR REPLACE INTO observations (product_key, key_type, host, price, currency, country, hour, install_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.agg = this.db.prepare(AGG_SQL);
  }

  static hourBucket(iso: string): string {
    return iso.slice(0, 13);
  }

  installHash(installId: string, day: string): string {
    const salt = createHash('sha256').update(`${this.secret}:${day}`).digest('hex');
    return createHash('sha256').update(`${installId}:${salt}`).digest('hex');
  }

  add(o: Observation, installId: string, now = new Date()): void {
    const at = now.toISOString();
    this.insert.run(
      o.productKey, o.productKeyType, new URL(o.url).hostname, o.price, o.currency, o.country ?? '',
      CrowdStore.hourBucket(at), this.installHash(installId, at.slice(0, 10)),
    );
  }

  aggregate(productKey: string, currency: string, country: string | undefined, window: 'hour' | 'day', now = new Date()): Aggregate | null {
    const bucket = window === 'hour' ? CrowdStore.hourBucket(now.toISOString()) : now.toISOString().slice(0, 10);
    const row = this.agg.get({ ':bucket': bucket, ':product_key': productKey, ':currency': currency, ':country': country ?? '' }) as
      | { n: number; installs: number; median: number; min: number; max: number }
      | undefined;
    if (!row) return null;
    return { window, bucket, n: row.n, installs: row.installs, median: row.median, min: row.min, max: row.max };
  }

  answer(productKey: string, currency: string, country: string | undefined, now = new Date()): CrowdAnswer {
    return {
      hour: this.aggregate(productKey, currency, country, 'hour', now),
      day: this.aggregate(productKey, currency, country, 'day', now),
    };
  }

  /** Every product with observations on a day, aggregated per hour. The open dataset. */
  exportDay(day: string): Array<Aggregate & { productKey: string; keyType: string; currency: string; country: string; host: string }> {
    const rows = this.db.prepare(
      `SELECT DISTINCT product_key, key_type, currency, country, host, hour FROM observations WHERE hour LIKE ? || '%' ORDER BY hour, product_key`,
    ).all(day) as Array<{ product_key: string; key_type: string; currency: string; country: string; host: string; hour: string }>;
    const out = [];
    for (const r of rows) {
      const a = this.agg.get({ ':bucket': r.hour, ':product_key': r.product_key, ':currency': r.currency, ':country': r.country }) as
        | { n: number; installs: number; median: number; min: number; max: number } | undefined;
      if (a) out.push({ window: 'hour' as const, bucket: r.hour, productKey: r.product_key, keyType: r.key_type, currency: r.currency, country: r.country, host: r.host, n: a.n, installs: a.installs, median: a.median, min: a.min, max: a.max });
    }
    return out;
  }

  /** Delete raw observations older than `days`. Aggregates for those days were already published. */
  purge(days: number, now = new Date()): number {
    const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
    const before = this.count();
    this.db.prepare('DELETE FROM observations WHERE substr(hour, 1, 10) < ?').run(cutoff);
    return before - this.count();
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS c FROM observations').get() as { c: number }).c;
  }

  close(): void {
    this.db.close();
  }
}
