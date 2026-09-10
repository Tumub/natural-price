import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ext = join(import.meta.dirname, '..');
const build = (env: Record<string, string>) => execFileSync('node', [join(ext, 'build.mjs')], { env: { ...process.env, ...env }, stdio: 'pipe' });

describe('build targets', () => {
  it('chrome gets a service worker, all websites, and the service origin baked in', () => {
    build({ NP_SERVICE_URL: 'https://api.example.org/' });
    const m = JSON.parse(readFileSync(join(ext, 'dist', 'manifest.json'), 'utf8'));
    expect(m.background).toEqual({ service_worker: 'background.js', type: 'module' });
    // The reader runs everywhere; the default mode still sends nothing anywhere.
    expect(m.host_permissions).toEqual(['<all_urls>']);
    expect(m.content_scripts[0].matches).toContain('<all_urls>');
    expect(m.browser_specific_settings).toBeUndefined();
    expect(readFileSync(join(ext, 'dist', 'background.js'), 'utf8')).toContain('https://api.example.org');
  });
  it('firefox gets an event page and a gecko id', () => {
    build({ NP_TARGET: 'firefox', NP_SERVICE_URL: 'https://api.example.org' });
    const m = JSON.parse(readFileSync(join(ext, 'dist-firefox', 'manifest.json'), 'utf8'));
    expect(m.background).toEqual({ scripts: ['background.js'], type: 'module' });
    expect(m.browser_specific_settings.gecko.id).toMatch(/^\{[0-9a-f-]+\}$/);
    expect(m.browser_specific_settings.gecko.strict_min_version).toBe('128.0');
  });
});
