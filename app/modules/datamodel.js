import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, stat, empty, select, simpleTable, kv, tabs, sidenav, codeBlock } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal } from '../core/ui/overlay.js';
import { rankBars } from '../core/ui/chart.js';
import { SCHEMA, TABLES, GROUPS, relationships, dependents } from '../data/schema.js';
import { moduleIntro } from './_shared.js';
import { saveFile } from '../core/download.js';
import * as F from '../core/format.js';

const TYPE_TONE = {
  id: 'purple', ref: 'info', money: 'ok', int: '', float: '', pct: '',
  bool: '', date: 'warn', time: 'warn', datetime: 'warn', enum: 'purple',
  json: '', array: '', string: '', text: '', email: '', phone: '', url: '', slug: '',
};

export default {
  id: 'datamodel',
  title: 'Data Model',
  icon: '🗄',
  group: 'Reference',
  order: 260,
  summary: 'Every table in the platform, its fields, and how the tables reference each other.',
  entities: [],

  search(q, ctx) {
    const ql = q.toLowerCase();
    return SCHEMA.filter(t => t.id.includes(ql) || t.label.toLowerCase().includes(ql)).slice(0, 4)
      .map(t => ({ title: t.label, sub: `${t.fields.length} fields · ${ctx.db.count(t.id)} rows`, path: `/datamodel/table/${t.id}`, kind: 'table' }));
  },

  render(ctx) {
    const { db, router, route } = ctx;
    if (route.sub === 'table' && route.id && TABLES[route.id]) return tableDetail(ctx, route.id);

    const view = route.query.view || 'tables';
    const edges = relationships();
    const totalRows = SCHEMA.reduce((s, t) => s + db.count(t.id), 0);

    const VIEWS = [
      { id: 'tables', title: 'Tables', count: SCHEMA.length },
      { id: 'map', title: 'Relationship map' },
      { id: 'volume', title: 'Row volume' },
      { id: 'glossary', title: 'Glossary' },
    ];

    const panes = {
      tables: () => h('div.col', ...GROUPS.map(g => {
        const rows = SCHEMA.filter(t => t.group === g.id);
        if (!rows.length) return null;
        return card({ title: g.id, sub: g.desc, flush: true },
          simpleTable(
            ['Table', 'What it holds', { label: 'Fields', align: 'num' }, { label: 'Rows', align: 'num' }, 'References', ''],
            rows.map(t => [
              h('div', h('div.mono.strong', t.id), h('div.small.muted', t.label)),
              h('span.small', t.desc),
              t.fields.length,
              F.num(db.count(t.id)),
              h('div.row', { style: { gap: '3px' } },
                ...[...new Set(t.fields.filter(f => f.ref).map(f => f.ref))].slice(0, 4).map(r => badge(r, 'info'))),
              btn('Open', { size: 'sm', onclick: () => router.go(`/datamodel/table/${t.id}`) }),
            ])));
      }).filter(Boolean)),

      map: () => h('div.col',
        card({ title: 'How the tables connect', sub: 'Read left to right: a row in the left table points at a row in the right table.', flush: true },
          simpleTable(['From table', 'Foreign key', 'Points at', 'Meaning'],
            edges.map(e => [
              h('a.mono', { href: `#/datamodel/table/${e.from}` }, e.from),
              h('span.mono.small', e.via),
              h('a.mono', { href: `#/datamodel/table/${e.to}` }, e.to),
              h('span.small.muted', `${TABLES[e.from].label} → ${e.label}`),
            ]))),
        card({ title: 'The spine', sub: 'The chain that carries a guest from browsing to settled money' },
          h('div', { style: { overflowX: 'auto' } }, spine()),
          h('div.mt-4', h('p.small',
            'Read it as a sentence: an ', mono('item'), ' generates dated ', mono('availability'),
            ' rows; a guest (a ', mono('contact'), ') books one, creating a ', mono('booking'),
            ' that holds one ', mono('booking_customer'), ' per seat; money against that booking is a ',
            mono('payment'), '; payments are batched into a ', mono('payout'), '.'))),
        card({ title: 'Most-referenced tables' },
          rankBars(SCHEMA.map(t => ({ label: t.id, value: dependents(t.id).length }))
            .filter(x => x.value > 0).sort((a, b) => b.value - a.value), { money: false, limit: 12 }))),

      volume: () => card({ title: 'Rows per table', sub: 'The current in-memory dataset' },
        rankBars(SCHEMA.map(t => ({ label: t.id, value: db.count(t.id) })).sort((a, b) => b.value - a.value),
          { money: false, limit: 40 })),

      glossary: () => card({ title: 'Vocabulary', sub: 'The words this platform uses, and what they actually mean', flush: true },
        simpleTable(['Term', 'Means'], [
          ['Item', 'A product definition — a tour, rental, lesson, ticket or charter. It has no date.'],
          ['Availability', 'One dated, timed departure of an item, with its own capacity. This is what a guest books.'],
          ['Schedule (template)', 'A recurrence rule that generates availabilities in bulk.'],
          ['Customer type', 'Who a seat is for: Adult, Child, Senior. Defined once for the whole company.'],
          ['Rate', 'The price of one customer type on one item. Item × customer type = one rate row.'],
          ['Booking', 'A reservation: one availability, one contact, N seats, one money trail.'],
          ['Booking customer', 'One seat on a booking, at one rate, with its own waiver and check-in state.'],
          ['Contact', 'The guest record, deduplicated by email so lifetime value survives rebooking.'],
          ['Channel', 'Where a booking came from: your website, the dashboard, a kiosk, an affiliate, an OTA, the API.'],
          ['Affiliate', 'A reseller or concierge who sells your inventory on commission.'],
          ['Lightframe', 'The booking overlay that opens on top of the operator’s own website.'],
          ['Manifest', 'The guide’s guest list for one departure: names, waivers, notes, pickups, balances.'],
          ['Payout', 'A settlement batch: gross sales minus refunds minus fees, wired to the bank account.'],
          ['Custom field', 'An operator-defined question, asked once per booking or once per guest.'],
          ['Resource', 'A finite thing a departure consumes: a boat, a van, a gear fleet, a guide.'],
        ])),
    };

    return h('div.page',
      pageHead({
        title: 'Data Model',
        sub: `${SCHEMA.length} tables · ${edges.length} foreign keys · ${F.num(totalRows)} rows loaded`,
        actions: [btn('Download schema JSON', { icon: '↓', onclick: () =>
          saveFile('fareharbor-schema.json', JSON.stringify(SCHEMA, null, 2), 'application/json') })],
      }),
      moduleIntro(this, 'This page is generated from app/data/schema.js — the same declaration the seed generator and the tables read. Add a field there and it appears here, typed and documented.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Tables', value: F.num(SCHEMA.length) }),
        stat({ label: 'Fields', value: F.num(SCHEMA.reduce((s, t) => s + t.fields.length, 0)) }),
        stat({ label: 'Foreign keys', value: F.num(edges.length) }),
        stat({ label: 'Rows loaded', value: F.num(totalRows) })),
      tabs(VIEWS, view, id => router.patchQuery({ view: id })),
      h('div.mt-4', panes[view]()));
  },
};

const mono = (s) => h('span.mono.strong', s);

function spine() {
  const nodes = ['item', 'availability', 'booking', 'booking_customer', 'payment', 'payout'];
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: '760px', padding: '8px 0' } },
    ...nodes.flatMap((n, i) => [
      i > 0 ? h('div', { style: { color: 'var(--fg-subtle)', fontSize: '18px' } }, '→') : null,
      h('a', {
        href: `#/datamodel/table/${n}`,
        style: {
          flex: 1, textAlign: 'center', padding: '12px 8px', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', background: 'var(--surface-2)', textDecoration: 'none',
        },
      }, h('div.mono.strong', n),
         h('div.small.muted', TABLES[n]?.label)),
    ].filter(Boolean)),
    h('div', { style: { color: 'var(--fg-subtle)' } }, ''),
    h('a', {
      href: '#/datamodel/table/contact',
      style: { flex: 1, textAlign: 'center', padding: '12px 8px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', textDecoration: 'none' },
    }, h('div.mono.strong', 'contact'), h('div.small.muted', 'attached to booking')));
}

/* --------------------------------------------------------- table page */
function tableDetail(ctx, id) {
  const { db, router, route } = ctx;
  const t = TABLES[id];
  const rows = db.all(id);
  const incoming = dependents(id);
  const outgoing = t.fields.filter(f => f.ref);
  const tab = route.query.tab || 'fields';

  const TABS = [
    { id: 'fields', title: 'Fields', count: t.fields.length },
    { id: 'rows', title: 'Rows', count: rows.length },
    { id: 'relations', title: 'Relations', count: incoming.length + outgoing.length },
    { id: 'shape', title: 'Example row' },
  ];

  const panes = {
    fields: () => card({ flush: true }, simpleTable(
      ['Field', 'Type', 'Label', 'References', 'Allowed values', 'Notes'],
      t.fields.map(f => [
        h('span.mono.strong', f.name),
        badge(f.type, TYPE_TONE[f.type] ?? ''),
        f.label,
        f.ref ? h('a.mono.small', { href: `#/datamodel/table/${f.ref}` }, f.ref) : h('span.muted', '—'),
        f.enum ? h('div.row', { style: { gap: '3px' } }, ...f.enum.map(v => badge(v))) : h('span.muted', '—'),
        h('span.small.muted', [f.required ? 'required' : null, f.desc].filter(Boolean).join(' · ') || ''),
      ]))),

    rows: () => card({ flush: true }, dataTable({
      rows,
      exportName: id,
      pageSize: 25,
      searchPlaceholder: `Search ${t.label.toLowerCase()}…`,
      columns: t.fields.slice(0, 9).map(f => ({
        key: f.name, label: f.label, align: ['money', 'int', 'float', 'pct'].includes(f.type) ? 'num' : null,
        render: (r) => cellFor(ctx, f, r[f.name]),
      })),
    })),

    relations: () => h('div.grid.c2',
      card({ title: 'This table points at', sub: 'Foreign keys leaving this table', flush: true },
        outgoing.length ? simpleTable(['Field', 'Target table', 'Meaning'],
          outgoing.map(f => [
            h('span.mono', f.name),
            h('a.mono', { href: `#/datamodel/table/${f.ref}` }, f.ref),
            h('span.small.muted', f.label),
          ])) : empty('No outgoing references')),
      card({ title: 'Points at this table', sub: 'Foreign keys arriving here', flush: true },
        incoming.length ? simpleTable(['Source table', 'Field', 'Meaning'],
          incoming.map(e => [
            h('a.mono', { href: `#/datamodel/table/${e.from}` }, e.from),
            h('span.mono', e.via),
            h('span.small.muted', `${TABLES[e.from].label} → ${e.label}`),
          ])) : empty('Nothing references this table'))),

    shape: () => card({ title: 'Example row', sub: 'The first row currently in memory' },
      rows.length ? codeBlock(JSON.stringify(rows[0], null, 2)) : empty('No rows')),
  };

  return h('div.page',
    pageHead({
      breadcrumb: h('a', { href: '#/datamodel' }, '‹ Data model'),
      title: t.label,
      sub: t.desc,
      actions: [badge(t.group, 'info'), badge(`${F.num(rows.length)} rows`)],
    }),
    h('div.banner.info.mb-4', h('span', '🗄'),
      h('div', h('div.strong', h('span.mono', t.id)),
        h('div.small', `${t.fields.length} fields · ${outgoing.length} outgoing references · ${incoming.length} tables reference it`))),
    tabs(TABS, tab, tid => router.patchQuery({ tab: tid })),
    h('div.mt-4', panes[tab]()));
}

function cellFor(ctx, f, v) {
  if (v === null || v === undefined || v === '') return h('span.muted', '—');
  switch (f.type) {
    case 'money': return F.money(v);
    case 'pct': return F.pct(v, 1);
    case 'bool': return v ? badge('true', 'ok') : badge('false');
    case 'date': return F.dateShort(v);
    case 'datetime': return h('span.small', F.dateShort(String(v).slice(0, 10)));
    case 'time': return F.time12(v);
    case 'enum': return badge(F.titleCase(v));
    case 'ref': return h('a.mono.small', { href: `#/datamodel/table/${f.ref}` }, String(v));
    case 'array': return h('span.small', Array.isArray(v) ? v.slice(0, 3).join(', ') + (v.length > 3 ? ` +${v.length - 3}` : '') : String(v));
    case 'json': return h('span.mono.small', JSON.stringify(v).slice(0, 40));
    case 'id': return h('span.mono.small', String(v));
    case 'text': return h('span.small', F.truncate(v, 60));
    default: return String(v);
  }
}
