import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Stats } from '../src/stats';

const ok = { observation: null, status: 'ok' as const, exitLocation: 'a' };
const blocked = { observation: null, status: 'blocked' as const, exitLocation: 'b' };

describe('Stats', () => {
  it('counts per host per day and computes success rate', () => {
    const s = new Stats();
    const d = new Date('2026-11-02T10:00:00Z');
    s.record('shop.a', [ok, ok], 'same', d);
    s.record('shop.a', [ok, blocked], 'higher', d);
    s.record('shop.b', [blocked], 'unknown', d);
    expect(s.snapshot()['2026-11-02']!['shop.a']).toMatchObject({ checks: 2, fetches: 4, ok: 3, blocked: 1, same: 1, higher: 1 });
    expect(s.successRate('shop.a')).toBeCloseTo(0.75);
    expect(s.successRate()).toBeCloseTo(0.6);
    expect(new Stats().successRate()).toBeNull();
  });
  it('round-trips through a file and keeps only recent days', () => {
    const s = new Stats(2);
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) s.record('h', [ok], 'same', new Date(day + 'T00:00:00Z'));
    expect(Object.keys(s.snapshot())).toEqual(['2026-11-02', '2026-11-03']);
    const file = join(mkdtempSync(join(tmpdir(), 'np-')), 'stats.json');
    s.save(file);
    const t = new Stats();
    t.load(file);
    expect(t.snapshot()).toEqual(s.snapshot());
    t.load('/nonexistent/file.json'); // silently ignored
  });
});
