/** kit.js — shared presentational components. */
import { h, frag } from '../dom.js';
import * as F from '../format.js';

export const card = (opts = {}, ...body) => {
  const { title, sub, actions, flush, foot, className } = opts;
  return h('div.card', { class: className },
    (title || actions) && h('div.card__head',
      h('div', { style: { minWidth: 0 } },
        title && h('h3', title),
        sub && h('div.sub', sub)),
      h('div.spacer'),
      actions && h('div.row', actions)),
    h('div.card__body', { class: flush ? 'flush' : '' }, ...body),
    foot && h('div.card__foot', foot));
};

export const pageHead = ({ title, sub, actions, breadcrumb }) =>
  h('div.page-head',
    h('div.page-head__text',
      breadcrumb && h('div.small.muted.mb-2', breadcrumb),
      h('h1', title),
      sub && h('div.sub', sub)),
    actions && h('div.page-head__actions', actions));

export const btn = (label, opts = {}) => {
  const { kind = '', size = '', icon, onclick, href, disabled, title, block } = opts;
  const cls = ['btn', kind, size, block ? 'block' : ''].filter(Boolean).join(' ');
  const kids = [icon && h('span', icon), label && h('span', label)].filter(Boolean);
  return href
    ? h('a', { class: cls, href, title }, ...kids)
    : h('button', { class: cls, onclick, disabled, title, type: 'button' }, ...kids);
};

export const badge = (label, tone = '', dot = false) =>
  h('span.badge', { class: tone }, dot && h('i.dot'), label);

/** Consistent colour for every enum value in the app. */
const TONES = {
  confirmed: 'ok', completed: 'ok', active: 'ok', live: 'ok', paid: 'ok', succeeded: 'ok',
  delivered: 'ok', opened: 'ok', signed: 'ok', open: 'ok', available: 'ok', assigned: 'ok', bookable: 'ok',
  pending: 'warn', in_transit: 'warn', scheduled: 'warn', partial: 'warn', tentative: 'warn',
  syncing: 'warn', in_progress: 'warn', past_due: 'warn', draft: 'warn', invited: 'warn',
  call_only: 'warn', sent: 'warn', maintenance: 'warn', tight: 'warn', sold_out: 'warn',
  cancelled: 'danger', failed: 'danger', bounced: 'danger', disputed: 'danger', error: 'danger',
  no_show: 'danger', failing: 'danger', revoked: 'danger', suspended: 'danger', void: 'danger',
  full: 'danger', urgent: 'danger', chargeback: 'danger',
  paused: '', archived: '', hidden: '', closed: '', lapsed: '', expired: '', retired: '',
  disabled: '', dismissed: '', released: '', not_required: '', none: '', low: '',
  trial: 'info', refund: 'info', charge: 'info', high: 'warn',
  redeemed: 'purple', done: 'purple',
};
export const statusBadge = (value, override) =>
  value == null || value === ''
    ? h('span.muted', '—')
    : badge(F.titleCase(value), override ?? (TONES[value] ?? ''), true);

export const stat = ({ label, value, delta, hint, spark, tone }) =>
  h('div.stat',
    h('div.stat__label', label, hint && h('span.subtle', { title: hint }, ' ⓘ')),
    h('div.stat__value', { style: tone ? { color: `var(--${tone})` } : null }, value),
    delta != null && h('div.stat__delta', { class: delta >= 0 ? 'up' : 'down' },
      `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(1)}% vs prior period`),
    spark && h('div.stat__spark', spark));

export const meter = (value, max, tone) => {
  const p = max ? Math.min(1, value / max) : 0;
  const auto = p >= 1 ? 'danger' : p >= 0.8 ? 'warn' : 'ok';
  return h('div.meter', { class: tone || auto, title: `${value} of ${max}` },
    h('i', { style: { width: `${p * 100}%` } }));
};

export const kv = (pairs) =>
  h('dl.kv', ...pairs.filter(Boolean).flatMap(([k, v]) => [h('dt', k), h('dd', v ?? '—')]));

export const empty = (title, sub, action) =>
  h('div.dt__empty', h('div.big', '⬚'), h('div.strong', title), sub && h('div.small.mt-2', sub),
    action && h('div.mt-4', action));

export const banner = (tone, ...body) => h('div.banner', { class: tone }, ...body);

export const avatar = (name, sm) =>
  h('div.avatar', { class: sm ? 'sm' : '', title: name }, F.initials(name));

export const tabs = (items, activeId, onSelect) =>
  h('div.tabs', ...items.map(t =>
    h('button', { class: t.id === activeId ? 'is-active' : '', onclick: () => onSelect(t.id) },
      t.title, t.count != null && h('span.cnt', F.num(t.count)))));

export const sidenav = (sections, activeId, onSelect) =>
  h('div.sidenav', ...sections.flatMap(sec => [
    sec.label && h('div.sec', sec.label),
    ...sec.items.map(i => h('button',
      { class: i.id === activeId ? 'is-active' : '', onclick: () => onSelect(i.id) }, i.title)),
  ]));

export const field = ({ label, hint, error, control, wide }) =>
  h('div.field', { style: wide ? { gridColumn: '1 / -1' } : null },
    label && h('label', label),
    control,
    hint && h('div.hint', hint),
    error && h('div.err', error));

export const input = (props = {}) => h('input.input', { type: 'text', ...props });
export const textarea = (props = {}) => h('textarea.textarea', props);
export const select = (options, value, onchange, props = {}) =>
  h('select.select', { onchange: (e) => onchange(e.target.value), ...props },
    ...options.map(o => {
      const [v, label] = Array.isArray(o) ? o : [o, F.titleCase(o)];
      return h('option', { value: v, selected: String(v) === String(value ?? '') }, label);
    }));
export const toggle = (checked, onchange) =>
  h('label.switch', h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }), h('span.track'));
export const checkbox = (label, checked, onchange) =>
  h('label.check', h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }), label);

export const qty = (value, onchange, { min = 0, max = 99 } = {}) =>
  h('div.qty',
    h('button', { onclick: () => onchange(Math.max(min, value - 1)), disabled: value <= min }, '−'),
    h('span', String(value)),
    h('button', { onclick: () => onchange(Math.min(max, value + 1)), disabled: value >= max }, '+'));

export const stepper = (steps, activeIdx) =>
  h('div.stepper', ...steps.flatMap((s, i) => [
    i > 0 && h('div.stepper__sep'),
    h('div.stepper__step', { class: i === activeIdx ? 'is-active' : i < activeIdx ? 'is-done' : '' },
      h('span.n', i < activeIdx ? '✓' : String(i + 1)), h('span', s)),
  ].filter(Boolean)));

export const timeline = (entries) =>
  h('ul.timeline', ...entries.map(e =>
    h('li', { class: e.tone || '' },
      h('div', e.title),
      e.detail && h('div.small.muted', e.detail),
      h('div.when', e.when))));

export const chip = (label, onRemove) =>
  h('span.chip', label, onRemove && h('button', { onclick: onRemove, title: 'Remove' }, '×'));

export const codeBlock = (text) => h('pre.code-block', text);

/** Divider with an optional caption. */
export const divider = (label) => label
  ? h('div.row.mt-4.mb-3', h('span.small.strong.muted', label), h('div.spacer'), h('div', { style: { height: '1px', background: 'var(--border)', flex: '2' } }))
  : h('div.divider');

export { F as fmt };

/**
 * simpleTable — a static table without the DataTable machinery.
 * headers: ['A', {label:'B', align:'num'}, ...]   rows: [[cell, cell], ...]
 * Keeps detail panels from turning into paren soup.
 */
export const simpleTable = (headers, rows, { footer } = {}) =>
  h('div.dt__scroll', h('table.dt__table',
    h('thead', h('tr', ...headers.map(x => {
      const o = typeof x === 'string' ? { label: x } : x;
      return h('th', { class: o.align === 'num' ? 'num' : '', style: o.width ? { width: o.width } : null }, o.label);
    }))),
    h('tbody', ...rows.map(cells => h('tr', ...cells.map((c, i) => {
      const o = typeof headers[i] === 'string' ? {} : headers[i] || {};
      return h('td', { class: o.align === 'num' ? 'num' : '' }, c);
    })))),
    footer && h('tfoot', h('tr', ...footer.map((c, i) => {
      const o = typeof headers[i] === 'string' ? {} : headers[i] || {};
      return h('td', { class: o.align === 'num' ? 'num' : '' }, c);
    })))));
