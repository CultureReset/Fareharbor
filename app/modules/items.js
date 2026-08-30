import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, meter, kv, tabs, toggle, checkbox, sidenav } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { rankBars, sparkline } from '../core/ui/chart.js';
import { moduleIntro, capacityCell, openBooking } from './_shared.js';
import { openDeparture } from './calendar.js';
import * as F from '../core/format.js';

export default {
  id: 'items',
  title: 'Items',
  icon: '🏄',
  group: 'Catalog',
  order: 80,
  summary: 'The product catalog. Each item carries its schedule, pricing, policies, waivers and online settings.',
  entities: ['item', 'availability_template', 'customer_type_rate', 'addon', 'cancellation_policy'],

  search(q, ctx) {
    const ql = q.toLowerCase();
    return ctx.db.where('item', i => i.name.toLowerCase().includes(ql)).slice(0, 5)
      .map(i => ({ title: i.name, sub: `${F.titleCase(i.category)} · ${F.duration(i.duration_minutes)}`, path: `/items/detail/${i.pk}`, kind: i.status }));
  },

  render(ctx) {
    const { db, domain, router, route } = ctx;
    if (route.sub === 'detail' && route.id) return itemDetail(ctx, route.id);

    const items = db.all('item');
    const stats = (it) => {
      const bookings = db.where('booking', b => b.item === it.pk && b.status !== 'cancelled');
      const avs = db.where('availability', a => a.item === it.pk && a.date >= F.addDays(F.today(), -90) && a.date <= F.today());
      return {
        bookings: bookings.length,
        revenue: bookings.reduce((s, b) => s + b.total, 0),
        pax: bookings.reduce((s, b) => s + b.pax, 0),
        upcoming: db.where('availability', a => a.item === it.pk && a.date >= F.today()).length,
        util: avs.length ? avs.reduce((s, a) => s + a.booked, 0) / Math.max(1, avs.reduce((s, a) => s + a.capacity, 0)) : 0,
      };
    };
    const cache = Object.fromEntries(items.map(i => [i.pk, stats(i)]));

    const table = dataTable({
      rows: items,
      exportName: 'items',
      defaultSort: 'sort_order',
      searchPlaceholder: 'Search items…',
      onRowClick: (i) => router.go(`/items/detail/${i.pk}`),
      columns: [
        { key: 'name', label: 'Item', render: i => h('div',
          h('div.strong', i.name), h('div.small.muted', F.truncate(i.headline, 62))) },
        { key: 'category', label: 'Type', render: i => badge(F.titleCase(i.category)) },
        { key: 'status', label: 'Status', render: i => statusBadge(i.status) },
        { key: 'duration_minutes', label: 'Duration', align: 'num', fmt: F.duration },
        { key: 'capacity_default', label: 'Capacity', align: 'num' },
        { key: 'price', label: 'From', align: 'num',
          value: i => Math.min(...domain.ratesFor(i.pk).map(r => r.total).filter(x => x > 0), Infinity),
          render: i => { const rs = domain.ratesFor(i.pk).map(r => r.total).filter(x => x > 0);
            return rs.length ? F.money(Math.min(...rs)) : '—'; } },
        { key: 'upcoming', label: 'Upcoming slots', align: 'num', value: i => cache[i.pk].upcoming },
        { key: 'util', label: 'Utilisation (90d)', align: 'num', value: i => cache[i.pk].util,
          render: i => h('div', { style: { minWidth: '90px' } },
            h('div.small.right', F.pct(cache[i.pk].util, 0)), meter(cache[i.pk].util * 100, 100)) },
        { key: 'revenue', label: 'Revenue', align: 'num', value: i => cache[i.pk].revenue, fmt: F.money },
        { key: 'online_booking', label: 'Online', render: i => i.online_booking ? badge('Live', 'ok', true) : badge('Off', '', true) },
      ],
      filters: [
        { key: 'category', label: 'Any type', options: ['tour', 'rental', 'lesson', 'ticket', 'charter', 'event'].map(c => [c, F.titleCase(c)]) },
        { key: 'status', label: 'Any status', options: ['live', 'draft', 'paused', 'archived'].map(c => [c, F.titleCase(c)]) },
      ],
    });

    const top = items.map(i => ({ label: i.name, value: cache[i.pk].revenue })).sort((a, b) => b.value - a.value);

    return h('div.page',
      pageHead({
        title: 'Items',
        sub: 'Everything you sell. An item is a product definition; its availabilities are the dated departures guests book.',
        actions: [btn('New item', { kind: 'primary', icon: '＋', onclick: () => newItem(ctx) })],
      }),
      moduleIntro(this, 'Click an item to open its full configuration: schedule, rates per customer type, booking rules, waivers, add-ons and online settings.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Items', value: F.num(items.length), hint: `${items.filter(i => i.status === 'live').length} live` }),
        stat({ label: 'Bookable online', value: F.num(items.filter(i => i.online_booking && i.status === 'live').length) }),
        stat({ label: 'Upcoming departures', value: F.num(db.where('availability', a => a.date >= F.today()).length) }),
        stat({ label: 'Catalog revenue (all time)', value: F.money(Object.values(cache).reduce((s, c) => s + c.revenue, 0)) })),
      h('div.grid.side.mb-4',
        card({ flush: true }, table),
        card({ title: 'Revenue by item', sub: 'All time' }, rankBars(top, { limit: 14 }))));
  },
};

/* ------------------------------------------------------- item detail */
function itemDetail(ctx, pk) {
  const { db, domain, router, route } = ctx;
  const it = db.get('item', pk);
  if (!it) return h('div.page', empty('Item not found'));
  const tab = route.query.tab || 'overview';

  const TABS = [
    { id: 'overview', title: 'Overview' },
    { id: 'pricing', title: 'Pricing', count: domain.ratesFor(it.pk).length },
    { id: 'schedule', title: 'Schedule' },
    { id: 'departures', title: 'Departures', count: db.where('availability', a => a.item === it.pk && a.date >= F.today()).length },
    { id: 'booking', title: 'Booking rules' },
    { id: 'online', title: 'Online & content' },
    { id: 'performance', title: 'Performance' },
  ];

  const set = (patch) => { db.update('item', it.pk, patch); };

  const bookings = db.where('booking', b => b.item === it.pk && b.status !== 'cancelled');
  const upcoming = db.where('availability', a => a.item === it.pk && a.date >= F.today())
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  const panes = {
    overview: () => h('div.grid.side',
      card({ title: 'Details' }, h('div.grid.c2',
        field('Item name', h('input.input', { value: it.name, onchange: e => set({ name: e.target.value }) }), true),
        field('Headline', h('input.input', { value: it.headline || '', onchange: e => set({ headline: e.target.value }) }), true),
        field('Description', h('textarea.textarea', { value: it.description || '', onchange: e => set({ description: e.target.value }) }), true),
        field('Category', select(['tour', 'rental', 'lesson', 'ticket', 'charter', 'event'], it.category, v => set({ category: v }))),
        field('Status', select(['live', 'draft', 'paused', 'archived'], it.status, v => set({ status: v }))),
        field('Duration (minutes)', h('input.input', { type: 'number', value: it.duration_minutes, onchange: e => set({ duration_minutes: Number(e.target.value) }) })),
        field('Default capacity', h('input.input', { type: 'number', value: it.capacity_default, onchange: e => set({ capacity_default: Number(e.target.value) }) })),
        field('Meeting location', select(db.all('location').map(l => [l.pk, l.name]), it.location, v => set({ location: v }))),
        field('Cancellation policy', select(db.all('cancellation_policy').map(p => [p.pk, p.name]), it.cancellation_policy, v => set({ cancellation_policy: v }))))),
      h('div.col',
        card({ title: 'At a glance' }, kv([
          ['Slug', h('span.mono.small', it.slug)],
          ['Bookings', F.num(bookings.length)],
          ['Guests carried', F.num(bookings.reduce((s, b) => s + b.pax, 0))],
          ['Revenue', F.money(bookings.reduce((s, b) => s + b.total, 0))],
          ['Upcoming departures', F.num(upcoming.length)],
          ['Requires waiver', it.requires_waiver ? badge('Yes', 'warn') : badge('No')],
        ])),
        card({ title: 'Guest-facing preview' },
          h('div', { style: { border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' } },
            h('div', { style: { height: '92px', background: 'linear-gradient(135deg, var(--brand-cyan), var(--brand-blue))' } }),
            h('div', { style: { padding: '12px' } },
              h('div.strong', it.name),
              h('div.small.muted.mt-2', it.headline),
              h('div.row.mt-3', badge(F.duration(it.duration_minutes)), badge(F.titleCase(it.category)),
                it.requires_waiver ? badge('Waiver', 'warn') : null),
              h('div.row.mt-3',
                h('span.strong', priceRange(ctx, it)),
                h('div.spacer'),
                btn('Book now', { kind: 'primary', size: 'sm', onclick: () => router.go(`/storefront/item/${it.pk}`) }))))))),

    pricing: () => h('div.col',
      card({ title: 'Rates by customer type', flush: true,
        actions: [btn('Add rate', { size: 'sm', onclick: () => addRate(ctx, it) })] },
        simpleTable(
          ['Customer type', 'Qualifier', { label: 'Price', align: 'num' }, { label: 'Cost basis', align: 'num' },
           { label: 'Margin', align: 'num' }, 'Counts a seat', ''],
          domain.ratesFor(it.pk).map(r => {
            const ct = db.get('customer_type', r.customer_type);
            const margin = r.total ? (r.total - r.cost) / r.total : 0;
            return [
              h('span.strong', ct?.singular || '—'), h('span.small.muted', ct?.note || ''),
              h('input.input', { type: 'number', step: '0.01', style: 'width:110px;text-align:right', value: (r.total / 100).toFixed(2),
                onchange: e => db.update('customer_type_rate', r.pk, { total: Math.round(Number(e.target.value) * 100) }) }),
              F.money(r.cost), F.pct(margin, 0),
              ct?.counts_against_capacity ? badge('Yes', 'ok') : badge('No'),
              btn('Remove', { size: 'sm', kind: 'ghost', onclick: () => { db.remove('customer_type_rate', r.pk); toast('Rate removed'); } }),
            ];
          }))),
      card({ title: 'Taxes & fees applied' },
        h('p.small.muted', 'Taxes and fees are defined company-wide and layered onto every booking of this item.'),
        simpleTable(['Name', 'Type', 'Calculation', { label: 'Rate', align: 'num' }],
          db.where('tax_fee', t => t.is_active).map(t => [
            t.name, badge(F.titleCase(t.kind)), F.titleCase(t.calculation),
            t.calculation === 'percent' ? F.pct(t.rate, 1) : F.money(t.rate),
          ])),
        h('div.mt-3', btn('Manage taxes & fees', { size: 'sm', onclick: () => router.go('/pricing', { tab: 'taxes' }) })))),

    schedule: () => h('div.col',
      card({ title: 'Recurring schedules', sub: 'Rules that generate departures in bulk', flush: true,
        actions: [btn('Add departures', { size: 'sm', kind: 'primary', onclick: () => router.go('/calendar', { new: 1, item: it.pk }) })] },
        (() => {
          const tpls = db.where('availability_template', t => t.item === it.pk);
          return tpls.length ? simpleTable(
            ['Schedule', 'Window', 'Days', 'Times', { label: 'Capacity', align: 'num' }, 'Active'],
            tpls.map(t => [
              h('span.strong', t.name),
              `${F.dateShort(t.start_date)} – ${F.dateShort(t.end_date)}`,
              t.days_of_week.map(d => F.dowName(d)).join(' '),
              t.times.map(F.time12).join(', '),
              t.capacity,
              toggle(t.is_active, v => db.update('availability_template', t.pk, { is_active: v })),
            ])) : empty('No schedule yet', 'Departures can also be added one at a time from the calendar.');
        })()),
      card({ title: 'How scheduling works' },
        h('p.small', 'A schedule is a recurrence rule: item + date window + days of week + times + capacity. '
          + 'Saving one generates an ', h('span.mono', 'availability'), ' row per slot. Editing a single departure — '
          + 'changing its capacity, closing it online, cancelling it — never touches the rule that made it, so one-off '
          + 'exceptions survive future regenerations.'))),

    departures: () => card({ title: `Upcoming departures (${upcoming.length})`, flush: true },
      upcoming.length ? simpleTable(
        ['Date', 'Time', { label: 'Capacity', width: '160px' }, 'Status', 'Online', ''],
        upcoming.slice(0, 60).map(a => [
          F.dateMed(a.date), F.time12(a.start_time), capacityCell(ctx, a),
          statusBadge(a.status), statusBadge(a.online_status),
          btn('Open', { size: 'sm', onclick: () => openDeparture(ctx, a) }),
        ])) : empty('No upcoming departures', 'Add a schedule to put this item on the calendar.')),

    booking: () => h('div.grid.c2',
      card({ title: 'Party size & cutoffs' }, h('div.col',
        field('Minimum party size', h('input.input', { type: 'number', value: it.min_party, onchange: e => set({ min_party: Number(e.target.value) }) })),
        field('Maximum party size', h('input.input', { type: 'number', value: it.max_party, onchange: e => set({ max_party: Number(e.target.value) }) })),
        field('Online booking cutoff', select([[0, 'No cutoff'], [60, '1 hour before'], [120, '2 hours before'], [1440, '24 hours before'], [2880, '48 hours before']],
          it.booking_cutoff_minutes, v => set({ booking_cutoff_minutes: Number(v) })),
          'After this point the departure stops accepting online bookings but stays bookable in the dashboard.'),
        field('Deposit', select([[0, 'Full payment at booking'], [0.25, '25% deposit'], [0.5, '50% deposit']],
          it.deposit_pct, v => set({ deposit_pct: Number(v) }))))),
      card({ title: 'Requirements' }, h('div.col', { style: { gap: '14px' } },
        row('Requires a signed waiver', 'Guests are chased by email until every person on the booking has signed.',
          toggle(it.requires_waiver, v => set({ requires_waiver: v }))),
        row('Bookable online', 'Turn off to make this a phone-and-desk-only product.',
          toggle(it.online_booking, v => set({ online_booking: v }))),
        h('div.divider'),
        h('div', h('div.small.strong.mb-2', 'Cancellation policy'),
          (() => { const p = db.get('cancellation_policy', it.cancellation_policy);
            return p ? h('div.banner.info', h('div', h('div.strong', p.name), h('div.small', p.description))) : h('div.muted', 'None set'); })()),
        h('div', h('div.small.strong.mb-2', 'Custom fields asked on this item'),
          h('div.row', ...db.where('custom_field', c => c.level !== 'item').slice(0, 5).map(c => badge(c.title)),
            btn('Manage', { size: 'sm', kind: 'ghost', onclick: () => router.go('/customfields') })))))),

    online: () => h('div.grid.c2',
      card({ title: 'Listing content' }, h('div.col',
        field('Headline', h('input.input', { value: it.headline || '', onchange: e => set({ headline: e.target.value }) })),
        field('Description', h('textarea.textarea', { style: 'min-height:150px', value: it.description || '', onchange: e => set({ description: e.target.value }) })),
        field('URL slug', h('input.input', { value: it.slug, onchange: e => set({ slug: e.target.value }) }),
          `Guests reach this item at fareharbor.com/${ctx.domain.company()?.shortname}/items/${it.slug}/`))),
      h('div.col',
        card({ title: 'Where this item is sold' },
          simpleTable(['Surface', 'Status'], [
            ['Website Lightframe widget', it.online_booking ? badge('Live', 'ok', true) : badge('Off', '', true)],
            ['Dashboard (phone & desk)', badge('Always on', 'ok', true)],
            ['Front desk kiosk', badge('Live', 'ok', true)],
            ...db.where('external_listing', l => l.item === it.pk).map(l => [l.marketplace, statusBadge(l.sync_status)]),
          ])),
        card({ title: 'Embed this item' },
          h('p.small.muted', 'Drop this on any page to open the Lightframe booking flow for this item.'),
          h('pre.code-block', `<a href="https://fareharbor.com/embeds/book/${ctx.domain.company()?.shortname}/items/${it.pk.replace('item_', '')}/?full-items=yes"\n   class="fh-button">Book ${it.name}</a>`),
          h('div.mt-3', btn('Manage book buttons', { size: 'sm', onclick: () => router.go('/widgets') }))))),

    performance: () => {
      const last90 = db.where('booking', b => b.item === it.pk && b.created_at.slice(0, 10) >= F.addDays(F.today(), -89) && b.status !== 'cancelled');
      const byChannel = db.groupBy(last90, b => db.label('channel', b.channel), { total: rs => rs.reduce((s, x) => s + x.total, 0) })
        .map(g => ({ label: g.key, value: g.total })).sort((a, b) => b.value - a.value);
      const series = [];
      for (let i = 11; i >= 0; i--) {
        const from = F.addDays(F.today(), -(i + 1) * 7), to = F.addDays(F.today(), -i * 7);
        series.push(last90.filter(b => b.created_at.slice(0, 10) > from && b.created_at.slice(0, 10) <= to).reduce((s, b) => s + b.total, 0));
      }
      const avs = db.where('availability', a => a.item === it.pk && a.date >= F.addDays(F.today(), -89) && a.date <= F.today());
      return h('div.col',
        h('div.grid.c4',
          stat({ label: 'Bookings (90d)', value: F.num(last90.length) }),
          stat({ label: 'Revenue (90d)', value: F.money(last90.reduce((s, b) => s + b.total, 0)), spark: sparkline(series, { w: 140 }) }),
          stat({ label: 'Average booking', value: F.money(last90.length ? Math.round(last90.reduce((s, b) => s + b.total, 0) / last90.length) : 0) }),
          stat({ label: 'Seat utilisation', value: F.pct(avs.length ? avs.reduce((s, a) => s + a.booked, 0) / Math.max(1, avs.reduce((s, a) => s + a.capacity, 0)) : 0, 0) })),
        h('div.grid.c2.mt-4',
          card({ title: 'Channel mix (90d)' }, rankBars(byChannel)),
          card({ title: 'Recent bookings', flush: true },
            simpleTable(['Confirmation', 'Guest', { label: 'Pax', align: 'num' }, { label: 'Total', align: 'num' }],
              last90.slice(-10).reverse().map(b => [
                h('a.mono', { href: `#/bookings/detail/${b.pk}` }, b.code),
                db.label('contact', b.contact), b.pax, F.money(b.total),
              ])))));
    },
  };

  return h('div.page',
    pageHead({
      breadcrumb: h('a', { href: '#/items' }, '‹ All items'),
      title: it.name,
      sub: `${F.titleCase(it.category)} · ${F.duration(it.duration_minutes)} · up to ${it.capacity_default} guests · ${priceRange(ctx, it)}`,
      actions: [
        statusBadge(it.status),
        btn('Preview as a guest', { onclick: () => router.go(`/storefront/item/${it.pk}`) }),
        btn('Book this item', { kind: 'primary', onclick: () => router.go('/book', { item: it.pk }) }),
      ],
    }),
    tabs(TABS, tab, (id) => router.patchQuery({ tab: id })),
    h('div.mt-4', panes[tab]()));

  function field(label, control, hint) {
    return h('div.field', h('label', label), control, hint && h('div.hint', hint));
  }
  function row(title, sub, control) {
    return h('div.row', h('div', { style: { flex: 1 } }, h('div.small.strong', title), h('div.small.muted', sub)), control);
  }
}

function priceRange(ctx, it) {
  const rs = ctx.domain.ratesFor(it.pk).map(r => r.total).filter(x => x > 0);
  if (!rs.length) return 'No rates set';
  const lo = Math.min(...rs), hi = Math.max(...rs);
  return lo === hi ? F.money(lo) : `${F.money(lo)} – ${F.money(hi)}`;
}

function addRate(ctx, it) {
  const { db } = ctx;
  const used = new Set(ctx.domain.ratesFor(it.pk).map(r => r.customer_type));
  const options = db.all('customer_type').filter(c => !used.has(c.pk));
  if (!options.length) return toast('Every customer type already has a rate on this item', { tone: 'warn' });
  let ct = options[0].pk, price = 5000;
  modal({
    title: `Add a rate to ${it.name}`,
    render: () => h('div.grid.c2',
      h('div.field', h('label', 'Customer type'), select(options.map(c => [c.pk, `${c.singular} — ${c.note || ''}`]), ct, v => { ct = v; })),
      h('div.field', h('label', 'Price'), h('input.input', { type: 'number', step: '0.01', value: (price / 100).toFixed(2), oninput: e => { price = Math.round(Number(e.target.value) * 100); } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Add rate', { kind: 'primary', onclick: () => {
        db.insert('customer_type_rate', { item: it.pk, customer_type: ct, availability: null,
          total: price, cost: Math.round(price * 0.42), minimum_party_size: 0, maximum_party_size: it.max_party, is_active: true });
        api.close(); toast('Rate added', { tone: 'ok' });
      } })],
  });
}

function newItem(ctx) {
  const { db, router } = ctx;
  const draft = { name: '', category: 'tour', duration_minutes: 120, capacity_default: 12, price: 6500 };
  modal({
    title: 'New item',
    sub: 'The minimum needed to get a product on the calendar. Everything else is editable afterwards.',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Item name'),
        h('input.input', { placeholder: 'Sunrise Estuary Paddle', oninput: e => { draft.name = e.target.value; } })),
      h('div.field', h('label', 'Category'), select(['tour', 'rental', 'lesson', 'ticket', 'charter', 'event'], draft.category, v => { draft.category = v; })),
      h('div.field', h('label', 'Duration (minutes)'), h('input.input', { type: 'number', value: draft.duration_minutes, oninput: e => { draft.duration_minutes = Number(e.target.value); } })),
      h('div.field', h('label', 'Default capacity'), h('input.input', { type: 'number', value: draft.capacity_default, oninput: e => { draft.capacity_default = Number(e.target.value); } })),
      h('div.field', h('label', 'Adult price'), h('input.input', { type: 'number', step: '0.01', value: (draft.price / 100).toFixed(2), oninput: e => { draft.price = Math.round(Number(e.target.value) * 100); } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Create item', { kind: 'primary', onclick: () => {
        if (!draft.name.trim()) return toast('Name the item first', { tone: 'warn' });
        const it = db.insert('item', {
          company: ctx.domain.company().pk, name: draft.name.trim(),
          slug: draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          category: draft.category, status: 'draft', headline: '', description: '',
          duration_minutes: draft.duration_minutes, capacity_default: draft.capacity_default,
          min_party: 1, max_party: 12, location: db.all('location')[0]?.pk,
          cancellation_policy: db.all('cancellation_policy')[0]?.pk, booking_cutoff_minutes: 120,
          requires_waiver: true, online_booking: true, deposit_pct: 0, image: '',
          sort_order: db.count('item'),
        });
        db.insert('customer_type_rate', { item: it.pk, customer_type: db.all('customer_type')[0].pk,
          availability: null, total: draft.price, cost: Math.round(draft.price * 0.42),
          minimum_party_size: 1, maximum_party_size: 12, is_active: true }, { log: false });
        api.close(); router.go(`/items/detail/${it.pk}`);
        toast('Item created as a draft', { detail: 'Add a schedule to put it on the calendar', tone: 'ok' });
      } })],
  });
}
