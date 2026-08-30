# Extending the Prototype

How to add a section, a table, a report, a column or a chart — and where the
seams are that make each of those a small change.

---

## The module contract

A section is one file in `app/modules/` exporting one object. Only `id`, `title`
and `render` are required; everything else is optional.

```js
export default {
  id:       'inventory',      // URL segment: #/inventory. Must be unique.
  title:    'Inventory',      // Sidebar and page label.
  icon:     '📦',             // Sidebar glyph.
  group:    'Operations',     // Sidebar heading. New groups appear automatically.
  order:    75,               // Position within the group.
  hidden:   false,            // true = reachable by URL, absent from the sidebar.
  summary:  'Consumables and stock levels per location.',
  entities: ['resource'],     // Tables this section touches. Documented on the
                              // Platform Map and linked to the Data Model.

  badge:    (ctx) => number | null,          // Sidebar counter.
  subnav:   (ctx) => [{ id, title }],        // Optional sub-navigation.
  search:   (q, ctx) => [{ title, sub, path, kind }],   // Global search results.
  commands: (ctx) => [{ title, path, run }], // Command palette verbs.

  render:   (ctx) => Node,    // Required. Return a DOM node.
};
```

### What `ctx` gives you

| Key | Is |
|---|---|
| `ctx.db` | The query layer — `all`, `get`, `where`, `find`, `query`, `rel`, `children`, `groupBy`, `sum`, `insert`, `update`, `remove`, `label` |
| `ctx.domain` | Business rules — `quote`, `capacityState`, `seatsLeft`, `createBooking`, `cancelBooking`, `refundQuote`, `checkIn`, `manifest`, `metrics`, `series`, `dayBoard` |
| `ctx.store` | Reactive state and the pub/sub bus. `store.get('currentUser')`, `store.on('booking:created', fn)` |
| `ctx.router` | `go(path, query)`, `patchQuery(patch)`, `href(path, query)` |
| `ctx.route` | The parsed current route: `{ module, sub, id, query, path }` |
| `ctx.registry` | Every registered module — used by the Platform Map to describe itself |

### Registering it

One import line in `app/main.js`:

```js
import inventory from './modules/inventory.js';

const MODULES = [
  home, todayMod, tasks,
  bookings, calendar, checkin, resources, inventory,   // ← added
  /* … */
];
```

Nothing else changes. The sidebar entry, the route, the global search
contribution, the command-palette entries and the Platform Map row all derive
from the registry.

Removing a section is deleting that line.

---

## A complete example

```js
// app/modules/inventory.js
import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, stat, empty } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, toast } from '../core/ui/overlay.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'inventory',
  title: 'Inventory',
  icon: '📦',
  group: 'Operations',
  order: 75,
  summary: 'Consumables and stock levels per location.',
  entities: ['resource', 'location'],

  badge: (ctx) => ctx.db.where('resource', r => r.status === 'maintenance').length || null,

  search: (q, ctx) => ctx.db
    .where('resource', r => r.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 5)
    .map(r => ({ title: r.name, sub: F.titleCase(r.kind), path: '/inventory' })),

  commands: () => [{ title: 'Inventory — needs service', path: '/inventory?f=service' }],

  render(ctx) {
    const { db, route } = ctx;
    const rows = route.query.f === 'service'
      ? db.where('resource', r => r.status === 'maintenance')
      : db.all('resource');

    return h('div.page',
      pageHead({
        title: 'Inventory',
        sub: 'What we own and where it lives.',
        actions: [btn('Add', { kind: 'primary', icon: '＋', onclick: () => toast('Stub') })],
      }),
      moduleIntro(this),

      h('div.grid.c3.mb-4',
        stat({ label: 'Assets', value: F.num(rows.length) }),
        stat({ label: 'In service', value: F.num(rows.filter(r => r.status === 'available').length) }),
        stat({ label: 'Total units', value: F.num(db.sum(rows, 'capacity')) })),

      card({ flush: true }, dataTable({
        rows,
        exportName: 'inventory',
        searchPlaceholder: 'Search assets…',
        onRowClick: (r) => drawer({
          title: r.name,
          sub: F.titleCase(r.kind),
          render: () => h('div', h('p', r.notes || 'No notes.')),
        }),
        columns: [
          { key: 'name',     label: 'Asset', render: r => h('div',
              h('div.strong', r.name),
              h('div.small.muted', db.label('location', r.location))) },
          { key: 'kind',     label: 'Type', render: r => badge(F.titleCase(r.kind)) },
          { key: 'capacity', label: 'Units', align: 'num', fmt: F.num },
          { key: 'status',   label: 'Status' },
        ],
        filters: [
          { key: 'kind',   label: 'Any type',
            options: ['vessel', 'vehicle', 'equipment'].map(k => [k, F.titleCase(k)]) },
          { key: 'status', label: 'Any status',
            options: ['available', 'maintenance'].map(k => [k, F.titleCase(k)]) },
        ],
        totals: (all) => ({ capacity: F.num(db.sum(all, 'capacity')) }),
      })));
  },
};
```

That is a complete, working section: searchable, sortable, filterable,
paginated, exportable, with a detail drawer, a sidebar counter, global-search
integration and a command-palette verb.

---

## Adding a table

Declare it in `app/data/schema.js`:

```js
T('inventory_item', 'Inventory', 'Operations',
  'Consumable stock held at a location.', [
  f('pk',         'id',     'ID'),
  f('company',    'ref',    'Company',  { ref: 'company' }),
  f('location',   'ref',    'Location', { ref: 'location' }),
  f('name',       'string', 'Item',     { required: true }),
  f('on_hand',    'int',    'Units on hand'),
  f('reorder_at', 'int',    'Reorder point'),
  f('unit_cost',  'money',  'Unit cost'),
  f('status',     'enum',   'Status', { enum: ['stocked', 'low', 'out'] }),
]),
```

It is immediately browsable in the **Data Model** section — typed field
rendering, relationships mapped in both directions, an example row — and
`docs/DATA-MODEL.md` regenerates to include it:

```bash
node tools/gen-docs.mjs > docs/DATA-MODEL.md
```

To give it realistic rows, add a block to `app/data/seed.js`. The generator has
`int`, `pick`, `weighted`, `chance` and `shuffle` helpers and a seeded PRNG, so
the data stays identical across reloads.

---

## Adding a report

Reports are declarative. A dataset names its rows, its dimensions and its
measures; the builder, the four chart shapes, the totals row and the CSV export
are all generic over that declaration.

In the `DATASETS` map at the top of `app/modules/reports.js`:

```js
inventory: {
  label: 'Inventory',
  desc:  'One row per asset. Use this for stock and service questions.',
  rows:  () => db.all('resource'),
  dateOf: () => F.today(),
  dimensions: {
    kind:     { label: 'Type',     of: r => F.titleCase(r.kind) },
    location: { label: 'Location', of: r => db.label('location', r.location) },
    status:   { label: 'Status',   of: r => F.titleCase(r.status) },
  },
  measures: {
    count: { label: 'Assets', of: rs => rs.length, fmt: F.num },
    units: { label: 'Units',  of: rs => rs.reduce((s, r) => s + r.capacity, 0), fmt: F.num },
  },
},
```

A preset — the buttons across the top of the Reports page — is one entry in
`PRESETS`:

```js
{ id: 'stock-by-location', title: 'Stock by location',
  dataset: 'inventory', dim: 'location', measures: ['count', 'units'] },
```

---

## The DataTable in full

```js
dataTable({
  rows,                       // array, or (state) => ({ rows, total, page, pages, allRows })
  columns: [{
    key:        'total',      // row property, and the sort key
    label:      'Total',
    align:      'num',        // right-aligns and applies tabular numerals
    width:      '120px',
    nowrap:     true,
    sortable:   false,        // default true
    hidden:     false,
    value:      r => …,       // computed value used for sorting, search and export
    render:     r => Node,    // full control over the cell
    fmt:        (v, r) => …,  // simple formatter, used when render is absent
    export:     false,        // omit from the CSV
    exportFmt:  r => 'text',  // CSV-specific formatting
  }],

  filters: [{
    key:     'status',
    label:   'Any status',                  // the placeholder / "no filter" option
    options: [['confirmed', 'Confirmed']],  // [value, label] pairs
    apply:   (row, value) => bool,          // optional; defaults to row[key] === value
  }],

  searchable:        true,
  searchPlaceholder: 'Search…',
  defaultSort:       'created_at',
  defaultDir:        'desc',
  pageSize:          25,
  dense:             false,
  exportName:        'bookings',            // <name>.csv

  onRowClick:  (row) => …,
  rowClass:    (row) => 'is-urgent',
  selectable:  true,
  bulkActions: (selectedPks, clearSelection) => [ btn(…) ],
  toolbar:     [ /* extra nodes in the toolbar */ ],
  totals:      (allRows) => ({ total: '$1,234.00' }),   // keyed by column key

  emptyTitle:  'Nothing here yet',
  emptySub:    'Try widening the date range.',
  emptyAction: btn('Reset filters', { onclick: … }),
});
```

---

## Overlays

```js
import { drawer, modal, confirm, menu, toast } from '../core/ui/overlay.js';

// Right-hand detail panel. `render(api)` gets { close, refresh, setTitle }.
drawer({
  title: 'Booking FH-44121',
  sub:   'Sunset Harbor Cruise · Sat 30 Aug',
  badge: statusBadge('confirmed'),
  width: 'wide',                       // omit for the default 760px
  render: (api) => h('div', …),
  foot:   (api) => [ btn('Save', { kind: 'primary', onclick: … }) ],
});

modal({ title, sub, width: 'wide', render: (api) => …, foot: (api) => [ … ] });

confirm({
  title: 'Cancel this departure?',
  body:  'Existing bookings stay on the record.',
  confirmLabel: 'Cancel departure',
  tone: 'danger',
  onConfirm: () => …,
});

menu(anchorElement, [
  { label: 'Resend confirmation', icon: '✉', onClick: … },
  'divider',
  { label: 'Cancel booking', icon: '✕', tone: 'danger', onClick: … },
]);

toast('Booking created', { detail: 'FH-60001', tone: 'ok' });   // ok | warn | danger
```

`Esc` closes the topmost overlay; clicking the scrim closes a drawer or modal.
Both re-render in place via `api.refresh()`, so a detail panel can mutate data
and redraw itself without the page underneath knowing.

---

## Charts

All SVG, no library, theme-aware:

```js
import { sparkline, barChart, rankBars, donut, legend, stackedBar, heatmap, seriesColor }
  from '../core/ui/chart.js';

sparkline([12, 18, 9, 24], { w: 150, tone: 'var(--purple)' });
barChart(rows, { height: 210, money: true });        // rows: [{ label, short, value }]
rankBars(rows, { money: false, limit: 10 });         // horizontal ranked bars
donut(rows, { centerLabel: '1,346', centerSub: 'bookings' });
legend(rows);
stackedBar(rows);
heatmap(cells, { cols, rowLabels, colLabels });
```

---

## Business rules

Screens should not compute. If you find yourself writing arithmetic in a
`render`, it probably belongs in `app/data/domain.js`:

```js
domain.quote({ item, lines, promoCode, addons })  // the full price breakdown
domain.capacityState(availability)                 // 'open' | 'tight' | 'full' | 'cancelled'
domain.seatsLeft(availability)
domain.isBookable(availability)
domain.ratesFor(itemPk)
domain.availabilitiesFor(itemPk, from, to)
domain.dayBoard(date)
domain.manifest(availabilityPk)
domain.createBooking({ availability, contact, lines, promoCode, payment, … })
domain.cancelBooking(booking, { refundAmount, reason })
domain.refundQuote(booking)
domain.takePayment(booking, { amount, method })
domain.checkIn(booking, { device })
domain.metrics(from, to)                           // KPIs plus the prior period
domain.series(from, to, valueFn)                   // daily series for charts
domain.outstandingBalances() / missingWaivers() / unassignedDepartures(from, to)
```

The point of the seam: the booking wizard, the guest storefront, the booking
detail panel and every report all call the same `quote()`. If a price is wrong,
there is exactly one place it can be wrong.

---

## Theming

Every colour, space, radius, shadow and type size is a custom property in
`styles/tokens.css`. Re-skinning is editing that file. Dark mode redefines the
same tokens under `[data-theme="dark"]`; no component knows which theme is
active.

```css
:root {
  --primary:   #0b7bc1;
  --sidebar-bg:#0b2540;
  --ok:        #15803d;
  --r-md:      6px;
  --fs-base:   14px;
  --sidebar-w: 232px;
}
```

Status colours are applied through `statusBadge(value)`, which maps every enum
value in the platform to a tone in one table in `kit.js`. Adding a new enum value
means adding one line there, and it is coloured consistently everywhere.

---

## Swapping in a real backend

Modules never touch raw arrays; they call `db.query()`, `db.get()`, `db.rel()`
and friends. Replacing the in-memory store with a real API means reimplementing
`app/data/db.js` against `fetch` and making the read methods async. The schema,
the domain rules, the components and all 29 sections stay as they are.

---

## Conventions worth keeping

| | |
|---|---|
| Money | Integer cents everywhere. Format with `F.money()` at the edge only. |
| Dates | `'YYYY-MM-DD'` strings, never `Date` objects. Compare lexicographically. |
| Times | `'HH:MM'` 24-hour strings. Format with `F.time12()`. |
| Nesting | If an `h()` call is more than four levels deep, pull it into a named function or use `simpleTable()`. |
| State | Filters and tabs go in the URL via `router.patchQuery()`, not in a closure. |
| Writes | Go through `db.insert/update/remove` so the audit log stays complete. Pass `{ log: false }` for bulk internal writes. |
| Status | Render with `statusBadge()` rather than a hand-rolled span. |
