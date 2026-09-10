import type { Observation } from './types';
import type { CheckResponse } from './messages';

/**
 * The badge. A small fixed panel in its own shadow root so the page's CSS
 * cannot touch it. States what was observed, never why.
 */

const CSS = `
:host { all: initial; }
.np { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; max-width: 340px;
  font: 13px/1.4 -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #111; background: #fff;
  border: 1px solid #d0d0d0; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.14); padding: 12px 14px; }
.np[data-verdict="higher"] { border-color: #c0392b; }
.np[data-verdict="lower"] { border-color: #2e7d32; }
.h { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.t { font-weight: 600; font-size: 12px; letter-spacing: .02em; text-transform: uppercase; color: #555; }
.x { all: unset; cursor: pointer; color: #888; font-size: 16px; line-height: 1; padding: 2px 4px; }
.x:hover { color: #111; }
.m { margin: 0; }
.c { color: #666; font-size: 12px; margin-top: 6px; }
.a { margin-top: 8px; font-size: 12px; }
.b { all: unset; display: inline-block; margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #111; color: #fff; font-size: 12px; cursor: pointer; }
.b:hover { background: #333; }
.s { margin-top: 6px; font-size: 12px; color: #444; }
.k { margin-top: 6px; font-size: 12px; color: #333; }
details { margin-top: 6px; font-size: 12px; color: #666; }
summary { cursor: pointer; }
ul { margin: 4px 0 0; padding-left: 16px; }
`;

function fmt(n: number, c: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c}`;
  }
}

export interface Badge {
  checking(): void;
  result(r: CheckResponse): void;
  error(msg: string): void;
  remove(): void;
}

export interface BadgeHandlers {
  /** Called when the user asks to open the page privately. Returns a status line to show. */
  openPrivate?: () => Promise<string>;
}

export function createBadge(yours: Observation, handlers: BadgeHandlers = {}): Badge {
  const host = document.createElement('div');
  host.setAttribute('data-natural-price', '');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  const box = document.createElement('div');
  box.className = 'np';
  root.append(style, box);
  document.documentElement.append(host);

  function render(verdict: string, main: string, extra: { confidence?: string; crowd?: string; action?: string; button?: boolean; reasons?: string[] } = {}) {
    box.dataset.verdict = verdict;
    box.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'h';
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = 'Natural Price';
    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = '×';
    x.title = 'Dismiss';
    x.addEventListener('click', () => host.remove());
    h.append(t, x);
    const m = document.createElement('p');
    m.className = 'm';
    m.setAttribute('data-np-verdict', verdict);
    m.textContent = main;
    box.append(h, m);
    if (extra.crowd) {
      const k = document.createElement('div');
      k.className = 'k';
      k.setAttribute('data-np-crowd', '');
      k.textContent = extra.crowd;
      box.append(k);
    }
    if (extra.confidence) {
      const c = document.createElement('div');
      c.className = 'c';
      c.textContent = `Confidence: ${extra.confidence}.`;
      box.append(c);
    }
    if (extra.action) {
      const a = document.createElement('div');
      a.className = 'a';
      a.textContent = extra.action;
      box.append(a);
    }
    if (extra.button && handlers.openPrivate) {
      const b = document.createElement('button');
      b.className = 'b';
      b.setAttribute('data-np-action', 'open-private');
      b.textContent = 'Open in a private window';
      const s = document.createElement('div');
      s.className = 's';
      s.setAttribute('data-np-status', '');
      b.addEventListener('click', async () => {
        b.disabled = true;
        s.textContent = await handlers.openPrivate!();
        b.disabled = false;
      });
      box.append(b, s);
    }
    if (extra.reasons && extra.reasons.length) {
      const d = document.createElement('details');
      const s = document.createElement('summary');
      s.textContent = 'Details';
      const ul = document.createElement('ul');
      for (const r of extra.reasons) {
        const li = document.createElement('li');
        li.textContent = r;
        ul.append(li);
      }
      d.append(s, ul);
      box.append(d);
    }
  }

  const y = fmt(yours.price, yours.currency);
  return {
    checking: () => render('checking', `You were shown ${y}. Checking what a clean session sees…`),
    result: (r) => {
      if (r.error) return render('error', `You were shown ${y}. Could not check: ${r.error}.`);
      if (!r.comparable || r.difference === undefined) {
        return render('unknown', `You were shown ${y}. Could not compare.`, { reasons: r.reasons });
      }
      const pct = Math.abs(Math.round(r.difference * 1000) / 10);
      const when = r.crowd?.window === 'hour' ? 'this hour' : 'today';
      const crowdLine = r.crowd && r.basis === 'clean' ? `${r.crowd.others} other people saw a median of ${fmt(r.crowd.median, yours.currency)} ${when}.` : undefined;
      // Who is the reference: a clean session, or the crowd when the clean fetch failed.
      const who =
        r.basis === 'crowd' && r.crowd
          ? `${r.crowd.others} other people saw a median of`
          : r.clean?.exitLocation === 'private-tab'
            ? 'A private tab on this device was shown'
            : 'A clean session was shown';
      const local = r.clean?.exitLocation === 'private-tab' && r.cleanFetches.every((c) => c.exitLocation === 'private-tab');
      const ref = r.basis === 'crowd' && r.crowd ? fmt(r.crowd.median, yours.currency) : r.clean ? fmt(r.clean.price, r.clean.currency) : '';
      const tail = r.basis === 'crowd' ? ` ${when}` : '';
      if (r.verdict === 'same') return render('same', `You were shown ${y}. ${who} the same${tail}.`, { confidence: local ? `${r.confidence}, checked on this device` : r.confidence, crowd: crowdLine, reasons: r.reasons });
      if (r.verdict === 'higher')
        return render('higher', `You were shown ${y}. ${who} ${ref}${tail}, ${pct}% less.`, {
          confidence: local ? `${r.confidence}, checked on this device` : r.confidence,
          crowd: crowdLine,
          action: 'Compare in a private window before you buy.',
          button: true,
          reasons: r.reasons,
        });
      return render('lower', `You were shown ${y}. ${who} ${ref}${tail}, ${pct}% more.`, { confidence: local ? `${r.confidence}, checked on this device` : r.confidence, crowd: crowdLine, reasons: r.reasons });
    },
    error: (msg) => render('error', `You were shown ${y}. Could not check: ${msg}.`),
    remove: () => host.remove(),
  };
}
