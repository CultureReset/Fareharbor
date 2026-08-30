import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, toggle, codeBlock, tabs, meter } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast } from '../core/ui/overlay.js';
import { rankBars } from '../core/ui/chart.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

const KINDS = [
  ['button', 'Book Now button', 'A single button. Clicking it opens the Lightframe over your page.'],
  ['inline_calendar', 'Inline calendar', 'An availability calendar embedded directly in the page for one item.'],
  ['item_list', 'Item list', 'A grid of every bookable item, each opening its own flow.'],
  ['full_page', 'Full-page flow', 'The whole booking flow on its own page or tab. Good for tablets and link-in-bio.'],
  ['popup', 'Timed popup', 'Opens on exit intent or after a delay. Used for gift cards and seasonal offers.'],
];

export default {
  id: 'widgets',
  title: 'Book Buttons',
  icon: '🔗',
  group: 'Distribution',
  order: 190,
  summary: 'The embeddable Lightframe entry points, their placement, and how each one converts.',
  entities: ['widget', 'item'],

  render(ctx) {
    const { db, router } = ctx;
    const widgets = db.all('widget');
    const views = widgets.reduce((s, w) => s + w.views_30d, 0);
    const books = widgets.reduce((s, w) => s + w.bookings_30d, 0);

    const table = dataTable({
      rows: widgets,
      exportName: 'book-buttons',
      defaultSort: 'bookings_30d', defaultDir: 'desc',
      searchPlaceholder: 'Search widgets…',
      onRowClick: (w) => openWidget(ctx, w),
      columns: [
        { key: 'name', label: 'Widget', render: w => h('div',
          h('div.strong', w.name), h('div.small.muted', w.placement)) },
        { key: 'kind', label: 'Type', render: w => badge(KINDS.find(k => k[0] === w.kind)?.[1] || w.kind) },
        { key: 'item', label: 'Scope', value: w => w.item ? db.label('item', w.item) : 'All items',
          render: w => w.item ? h('span.small', db.label('item', w.item)) : h('span.small.muted', 'All items') },
        { key: 'flow', label: 'Opens as', render: w => h('span.small', F.titleCase(w.flow)) },
        { key: 'views_30d', label: 'Views 30d', align: 'num', fmt: F.num },
        { key: 'bookings_30d', label: 'Bookings 30d', align: 'num', fmt: F.num },
        { key: 'cvr', label: 'Conversion', align: 'num', value: w => w.views_30d ? w.bookings_30d / w.views_30d : 0,
          render: w => { const r = w.views_30d ? w.bookings_30d / w.views_30d : 0;
            return h('div', { style: { minWidth: '90px' } }, h('div.small.right', F.pct(r, 2)), meter(r * 100, 5)); } },
        { key: 'is_active', label: 'Live', render: w => toggle(w.is_active, v => db.update('widget', w.pk, { is_active: v })) },
      ],
      filters: [{ key: 'kind', label: 'Any type', options: KINDS.map(k => [k[0], k[1]]) }],
      totals: (rows) => ({
        views_30d: F.num(rows.reduce((s, w) => s + w.views_30d, 0)),
        bookings_30d: F.num(rows.reduce((s, w) => s + w.bookings_30d, 0)),
      }),
    });

    return h('div.page',
      pageHead({
        title: 'Book Buttons & Widgets',
        sub: 'How guests get from your website into the booking flow.',
        actions: [btn('New widget', { kind: 'primary', icon: '＋', onclick: () => editWidget(ctx, null) })],
      }),
      moduleIntro(this, 'The Lightframe is FareHarbor’s booking overlay: it opens on top of your own site rather than sending the guest to a different domain, so the visitor never feels handed off.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Widgets', value: F.num(widgets.length), hint: `${widgets.filter(w => w.is_active).length} live` }),
        stat({ label: 'Views (30d)', value: F.num(views) }),
        stat({ label: 'Bookings (30d)', value: F.num(books) }),
        stat({ label: 'Blended conversion', value: F.pct(views ? books / views : 0, 2) })),
      h('div.grid.side.mb-4',
        card({ title: 'Bookings by placement (30d)' },
          rankBars(widgets.map(w => ({ label: w.name, value: w.bookings_30d })).sort((a, b) => b.value - a.value), { money: false })),
        card({ title: 'Widget types' },
          h('div.col', { style: { gap: '11px' } }, ...KINDS.map(([id, label, desc]) =>
            h('div', h('div.small.strong', label), h('div.small.muted', desc)))))),
      card({ flush: true }, table),
      h('div.mt-4', card({ title: 'Lightframe preview', sub: 'What the overlay looks like over an operator site' },
        h('div', { style: { position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', height: '340px', background: 'var(--surface-3)' } },
          h('div', { style: { padding: '18px', opacity: .35 } },
            h('div', { style: { height: '14px', width: '160px', background: 'var(--fg-subtle)', borderRadius: '3px' } }),
            h('div', { style: { height: '80px', marginTop: '14px', background: 'var(--fg-subtle)', borderRadius: '6px' } }),
            h('div', { style: { height: '10px', width: '70%', marginTop: '14px', background: 'var(--fg-subtle)', borderRadius: '3px' } }),
            h('div', { style: { height: '10px', width: '50%', marginTop: '8px', background: 'var(--fg-subtle)', borderRadius: '3px' } })),
          h('div', { style: { position: 'absolute', inset: 0, background: 'rgba(11,37,64,.5)' } }),
          h('div', {
            style: {
              position: 'absolute', inset: '26px 15% 26px 15%', background: 'var(--surface)',
              borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-3)', padding: '20px', overflow: 'hidden',
            },
          },
            h('div.row.mb-3', h('div.strong', ctx.domain.company()?.name), h('div.spacer'), h('span.subtle', '✕')),
            h('div.strong.mb-2', db.all('item')[0]?.name),
            h('div.small.muted.mb-3', db.all('item')[0]?.headline),
            h('div.row', ...['9:00am', '1:00pm', '5:30pm'].map((t, i) =>
              btn(t, { size: 'sm', kind: i === 0 ? 'primary' : '' }))),
            h('div.mt-4', btn('Continue', { kind: 'primary' })))),
        h('div.mt-3', btn('Open the working storefront', { onclick: () => router.go('/storefront') })))));
  },
};

function openWidget(ctx, w) {
  const { db } = ctx;
  const shortname = ctx.domain.company()?.shortname;
  const embed = w.kind === 'inline_calendar'
    ? `<script src="https://fareharbor.com/embeds/api/v1/?autolightframe=yes"></script>\n<div class="fh-calendar"\n     data-shortname="${shortname}"\n     data-item="${(w.item || '').replace('item_', '')}"></div>`
    : w.kind === 'item_list'
    ? `<script src="https://fareharbor.com/embeds/api/v1/?autolightframe=yes"></script>\n<div class="fh-items" data-shortname="${shortname}"></div>`
    : `<script src="https://fareharbor.com/embeds/api/v1/?autolightframe=yes"></script>\n<a href="https://fareharbor.com/embeds/book/${shortname}/${w.item ? 'items/' + w.item.replace('item_', '') + '/' : ''}?full-items=yes"\n   class="fh-button">Book Now</a>`;

  drawer({
    title: w.name,
    sub: `${KINDS.find(k => k[0] === w.kind)?.[1]} · ${w.placement}`,
    badge: w.is_active ? badge('Live', 'ok', true) : badge('Paused', '', true),
    render: (api) => h('div.col', { style: { gap: 'var(--sp-4)' } },
      h('div.grid.c3',
        h('div.stat', h('div.stat__label', 'Views 30d'), h('div.stat__value', F.num(w.views_30d))),
        h('div.stat', h('div.stat__label', 'Bookings 30d'), h('div.stat__value', F.num(w.bookings_30d))),
        h('div.stat', h('div.stat__label', 'Conversion'),
          h('div.stat__value', F.pct(w.views_30d ? w.bookings_30d / w.views_30d : 0, 2)))),
      card({ title: 'Configuration' }, h('div.grid.c2',
        h('div.field', h('label', 'Name'), h('input.input', { value: w.name, onchange: e => db.update('widget', w.pk, { name: e.target.value }) })),
        h('div.field', h('label', 'Placement note'), h('input.input', { value: w.placement, onchange: e => db.update('widget', w.pk, { placement: e.target.value }) })),
        h('div.field', h('label', 'Type'), select(KINDS.map(k => [k[0], k[1]]), w.kind, v => { db.update('widget', w.pk, { kind: v }); api.refresh(); })),
        h('div.field', h('label', 'Opens as'),
          select([['lightframe', 'Lightframe overlay'], ['new_tab', 'New tab'], ['inline', 'Inline on the page']], w.flow, v => db.update('widget', w.pk, { flow: v }))),
        h('div.field', h('label', 'Scoped to item'),
          select([['', 'All items'], ...db.all('item').map(i => [i.pk, i.name])], w.item || '', v => { db.update('widget', w.pk, { item: v || null }); api.refresh(); })),
        h('div.field', h('label', 'Accent colour'),
          h('input.input', { type: 'color', value: w.theme_color, onchange: e => db.update('widget', w.pk, { theme_color: e.target.value }) })))),
      card({ title: 'Embed code', sub: 'Paste this into your site where the button should appear' },
        codeBlock(embed),
        h('div.mt-3', btn('Copy', { size: 'sm', icon: '⧉', onclick: () => {
          navigator.clipboard?.writeText(embed); toast('Embed code copied', { tone: 'ok' });
        } }))),
      card({ title: 'Rendered' },
        w.kind === 'button'
          ? h('button.btn.lg', { style: { background: w.theme_color, color: '#fff', borderColor: w.theme_color } }, 'Book Now')
          : h('div', { style: { border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px' } },
              h('div.small.muted', 'Inline embed placeholder — the working flow is under Guest Storefront.')))),
    foot: (api) => [btn('Open the storefront', { kind: 'primary', onclick: () => { api.close(); ctx.router.go('/storefront'); } })],
  });
}

function editWidget(ctx, w) {
  const { db } = ctx;
  const d = { name: '', kind: 'button', item: '', flow: 'lightframe', theme_color: '#0b7bc1', placement: '' };
  modal({
    title: 'New widget',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Name'),
        h('input.input', { placeholder: 'Footer Book Now', oninput: e => { d.name = e.target.value; } })),
      h('div.field', h('label', 'Type'), select(KINDS.map(k => [k[0], k[1]]), d.kind, v => { d.kind = v; })),
      h('div.field', h('label', 'Scoped to item'),
        select([['', 'All items'], ...db.all('item').map(i => [i.pk, i.name])], d.item, v => { d.item = v; })),
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Where will it live?'),
        h('input.input', { placeholder: 'Site footer, every page', oninput: e => { d.placement = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Create widget', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name it', { tone: 'warn' });
        db.insert('widget', { company: ctx.domain.company().pk, ...d, item: d.item || null,
          views_30d: 0, bookings_30d: 0, is_active: true });
        api.close(); toast('Widget created', { tone: 'ok' });
      } })],
  });
}
