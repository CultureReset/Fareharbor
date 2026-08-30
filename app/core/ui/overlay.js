/** overlay.js — drawers, modals, menus, toasts and confirms. One layer, one API. */
import { h, dismissable } from '../dom.js';
import { btn } from './kit.js';

let layer = null;
const layerEl = () => (layer ||= document.body.appendChild(h('div#overlay-layer')));
const toastEl = (() => { let t = null; return () => (t ||= document.body.appendChild(h('div.toasts'))); })();

const stack = [];

function close(entry) {
  const i = stack.indexOf(entry);
  if (i < 0) return;
  stack.splice(i, 1);
  entry.nodes.forEach(n => n.remove());
  entry.cleanup?.();
  entry.onClose?.();
}
export function closeAll() { [...stack].reverse().forEach(close); }

function esc(entry) {
  const fn = (e) => { if (e.key === 'Escape' && stack[stack.length - 1] === entry) { e.stopPropagation(); close(entry); } };
  document.addEventListener('keydown', fn);
  return () => document.removeEventListener('keydown', fn);
}

/**
 * Right-hand drawer — the detail surface used for records everywhere.
 * `render(api)` receives { close, refresh } so content can re-render itself.
 */
export function drawer({ title, sub, badge, width, foot, render, onClose }) {
  const scrim = h('div.scrim');
  const body = h('div.drawer__body');
  const footEl = h('div.drawer__foot');
  const el = h('div.drawer', { class: width === 'wide' ? 'wide' : '' },
    h('div.drawer__head',
      h('div', { style: { minWidth: 0, flex: 1 } },
        h('div.row', h('h2', title), badge),
        sub && h('div.small.muted.mt-2', sub)),
      btn('', { kind: 'ghost', icon: '✕', onclick: () => close(entry), title: 'Close' })),
    body, footEl);

  const entry = { nodes: [scrim, el], onClose };
  entry.cleanup = esc(entry);
  scrim.addEventListener('click', () => close(entry));

  const api = {
    close: () => close(entry),
    refresh: () => {
      body.replaceChildren();
      const content = render(api);
      if (content) body.append(content);
      footEl.replaceChildren();
      const f = typeof foot === 'function' ? foot(api) : foot;
      if (f) { footEl.append(...[].concat(f)); footEl.style.display = ''; }
      else footEl.style.display = 'none';
    },
    setTitle: (t) => { el.querySelector('h2').textContent = t; },
  };
  layerEl().append(scrim, el);
  stack.push(entry);
  api.refresh();
  return api;
}

export function modal({ title, sub, width, render, foot, onClose }) {
  const scrim = h('div.scrim');
  const body = h('div.modal__body');
  const footEl = h('div.modal__foot');
  const el = h('div.modal', { class: width === 'wide' ? 'wide' : '' },
    h('div.modal__head',
      h('div', { style: { flex: 1, minWidth: 0 } }, h('h3', title), sub && h('div.small.muted.mt-2', sub)),
      btn('', { kind: 'ghost', icon: '✕', onclick: () => close(entry) })),
    body, footEl);

  const entry = { nodes: [scrim, el], onClose };
  entry.cleanup = esc(entry);
  scrim.addEventListener('click', () => close(entry));

  const api = {
    close: () => close(entry),
    refresh: () => {
      body.replaceChildren();
      const c = render(api); if (c) body.append(c);
      footEl.replaceChildren();
      const f = typeof foot === 'function' ? foot(api) : foot;
      if (f) { footEl.append(...[].concat(f)); footEl.style.display = ''; } else footEl.style.display = 'none';
    },
  };
  layerEl().append(scrim, el);
  stack.push(entry);
  api.refresh();
  return api;
}

export function confirm({ title, body, confirmLabel = 'Confirm', tone = 'primary', onConfirm }) {
  return modal({
    title,
    render: () => h('div', typeof body === 'string' ? h('p', body) : body),
    foot: (api) => [
      btn('Cancel', { onclick: api.close }),
      btn(confirmLabel, { kind: tone, onclick: () => { api.close(); onConfirm?.(); } }),
    ],
  });
}

/** Anchored popup menu. `items`: [{label, icon, tone, onClick}] or 'divider'. */
export function menu(anchorEl, items) {
  const r = anchorEl.getBoundingClientRect();
  const el = h('div.menu', { style: { top: `${r.bottom + 4}px`, left: `${Math.max(8, Math.min(r.left, innerWidth - 210))}px` } },
    ...items.map(it => it === 'divider' ? h('hr')
      : h('button', { class: it.tone || '', onclick: () => { done(); it.onClick?.(); } },
          it.icon && h('span', it.icon), h('span', it.label))));
  document.body.append(el);
  const cleanup = dismissable(el, () => done());
  function done() { cleanup(); el.remove(); }
  return done;
}

export function toast(title, { detail, tone = '', ms = 3600 } = {}) {
  const el = h('div.toast', { class: tone }, h('div.t', title), detail && h('div.d', detail));
  toastEl().append(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 260); }, ms);
  return el;
}
