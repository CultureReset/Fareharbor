import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, tabs, sidenav, meter, checkbox } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { modal, toast, drawer } from '../core/ui/overlay.js';
import { barChart, rankBars, donut, legend, sparkline, heatmap, stackedBar, seriesColor } from '../core/ui/chart.js';
import { moduleIntro, rangePicker, rangeOf, openBooking } from './_shared.js';
import * as F from '../core/format.js';

/**
 * Datasets are declared, not hard-coded into screens: each one names its rows,
 * the dimensions you can group by, and the measures you can total. The builder
 * below is generic over that declaration, so adding a report is adding a row here.
 */
const DATASETS = (ctx) => {
  const { db } = ctx;
  return {
    bookings: {
      label: 'Bookings',
      desc: 'One row per reservation. The default dataset for sales questions.',
      rows: (from, to) => db.where('booking', b => {
        const d = b.created_at.slice(0, 10); return d >= from && d <= to;
      }),
      dateOf: (r) => r.created_at.slice(0, 10),
      dimensions: {
        item: { label: 'Item', of: r => db.label('item', r.item) },
        channel: { label: 'Channel', of: r => db.label('channel', r.channel) },
        status: { label: 'Status', of: r => F.titleCase(r.status) },
        affiliate: { label: 'Affiliate', of: r => r.affiliate ? db.label('affiliate', r.affiliate) : 'Direct' },
        user: { label: 'Booked by', of: r => r.created_by ? db.label('user', r.created_by) : 'Guest self-service' },
        promo: { label: 'Promo code', of: r => r.promo_code ? db.label('promo_code', r.promo_code) : 'No code' },
        waiver: { label: 'Waiver state', of: r => F.titleCase(r.waiver_status) },
        weekday: { label: 'Day of week', of: r => F.dowName(F.parseISO(r.created_at.slice(0, 10)).getDay()) },
        month: { label: 'Month booked', of: r => r.created_at.slice(0, 7) },
        lodging: { label: 'Pickup lodging', of: r => r.lodging ? db.label('lodging', r.lodging) : 'Meets on site' },
      },
      measures: {
        count: { label: 'Bookings', of: rs => rs.length, fmt: F.num },
        pax: { label: 'Guests', of: rs => rs.reduce((s, r) => s + r.pax, 0), fmt: F.num },
        revenue: { label: 'Booked value', of: rs => rs.reduce((s, r) => s + r.total, 0), fmt: F.money, money: true },
        subtotal: { label: 'Subtotal', of: rs => rs.reduce((s, r) => s + r.subtotal, 0), fmt: F.money, money: true },
        tax: { label: 'Taxes & fees', of: rs => rs.reduce((s, r) => s + r.tax_total, 0), fmt: F.money, money: true },
        discount: { label: 'Discounts', of: rs => rs.reduce((s, r) => s + r.discount_total, 0), fmt: F.money, money: true },
        paid: { label: 'Collected', of: rs => rs.reduce((s, r) => s + r.paid, 0), fmt: F.money, money: true },
        balance: { label: 'Outstanding', of: rs => rs.reduce((s, r) => s + r.balance, 0), fmt: F.money, money: true },
        avg: { label: 'Average booking', of: rs => rs.length ? Math.round(rs.reduce((s, r) => s + r.total, 0) / rs.length) : 0, fmt: F.money, money: true },
      },
    },
    payments: {
      label: 'Payments',
      desc: 'One row per money movement. Use this for cash-flow and fee questions.',
      rows: (from, to) => db.where('payment', p => {
        const d = p.created_at.slice(0, 10); return d >= from && d <= to;
      }),
      dateOf: (r) => r.created_at.slice(0, 10),
      dimensions: {
        method: { label: 'Method', of: r => F.titleCase(r.method) },
        kind: { label: 'Transaction type', of: r => F.titleCase(r.kind) },
        status: { label: 'Status', of: r => F.titleCase(r.status) },
        card: { label: 'Card brand', of: r => r.card_brand || 'Not a card' },
        payout: { label: 'Payout', of: r => r.payout ? db.label('payout', r.payout) : 'Unsettled' },
        user: { label: 'Taken by', of: r => r.created_by ? db.label('user', r.created_by) : 'Online' },
        month: { label: 'Month', of: r => r.created_at.slice(0, 7) },
      },
      measures: {
        count: { label: 'Transactions', of: rs => rs.length, fmt: F.num },
        amount: { label: 'Amount', of: rs => rs.reduce((s, r) => s + r.amount, 0), fmt: F.money, money: true },
        fee: { label: 'Fees', of: rs => rs.reduce((s, r) => s + r.fee, 0), fmt: F.money, money: true },
        net: { label: 'Net', of: rs => rs.reduce((s, r) => s + r.net, 0), fmt: F.money, money: true },
      },
    },
    availability: {
      label: 'Capacity',
      desc: 'One row per departure. Use this for utilisation and scheduling questions.',
      rows: (from, to) => db.where('availability', a => a.date >= from && a.date <= to),
      dateOf: (r) => r.date,
      dimensions: {
        item: { label: 'Item', of: r => db.label('item', r.item) },
        weekday: { label: 'Day of week', of: r => F.dowName(F.parseISO(r.date).getDay()) },
        hour: { label: 'Departure hour', of: r => F.time12(r.start_time.slice(0, 2) + ':00') },
        status: { label: 'Status', of: r => F.titleCase(r.status) },
        online: { label: 'Online status', of: r => F.titleCase(r.online_status) },
        month: { label: 'Month', of: r => r.date.slice(0, 7) },
      },
      measures: {
        count: { label: 'Departures', of: rs => rs.length, fmt: F.num },
        capacity: { label: 'Seats offered', of: rs => rs.reduce((s, r) => s + r.capacity, 0), fmt: F.num },
        booked: { label: 'Seats sold', of: rs => rs.reduce((s, r) => s + r.booked, 0), fmt: F.num },
        util: { label: 'Utilisation', of: rs => {
          const c = rs.reduce((s, r) => s + r.capacity, 0);
          return c ? rs.reduce((s, r) => s + r.booked, 0) / c : 0;
        }, fmt: (v) => F.pct(v, 1) },
        empty: { label: 'Empty seats', of: rs => rs.reduce((s, r) => s + (r.capacity - r.booked), 0), fmt: F.num },
      },
    },
    contacts: {
      label: 'Guests',
      desc: 'One row per contact. Use this for audience and loyalty questions.',
      rows: () => db.all('contact'),
      dateOf: (r) => r.last_booked || F.today(),
      dimensions: {
        country: { label: 'Country', of: r => r.country || 'Unknown' },
        city: { label: 'City', of: r => r.city || 'Unknown' },
        consent: { label: 'Marketing consent', of: r => r.marketing_opt_in ? 'Opted in' : 'Not opted in' },
        frequency: { label: 'Frequency', of: r => r.booking_count === 0 ? 'Never booked' : r.booking_count === 1 ? 'One booking' : r.booking_count < 5 ? '2–4 bookings' : '5+ bookings' },
      },
      measures: {
        count: { label: 'Guests', of: rs => rs.length, fmt: F.num },
        ltv: { label: 'Lifetime value', of: rs => rs.reduce((s, r) => s + r.lifetime_value, 0), fmt: F.money, money: true },
        bookings: { label: 'Bookings', of: rs => rs.reduce((s, r) => s + r.booking_count, 0), fmt: F.num },
        avgLtv: { label: 'Average value', of: rs => rs.length ? Math.round(rs.reduce((s, r) => s + r.lifetime_value, 0) / rs.length) : 0, fmt: F.money, money: true },
      },
    },
  };
};

/** Pre-built reports — the ones an operator opens without configuring anything. */
const PRESETS = [
  { id: 'sales-by-item', title: 'Sales by item', dataset: 'bookings', dim: 'item', measures: ['count', 'pax', 'revenue', 'avg'] },
  { id: 'channel-mix', title: 'Channel mix', dataset: 'bookings', dim: 'channel', measures: ['count', 'revenue', 'avg'] },
  { id: 'utilisation', title: 'Capacity utilisation', dataset: 'availability', dim: 'item', measures: ['count', 'capacity', 'booked', 'util', 'empty'] },
  { id: 'weekday', title: 'Best days to run', dataset: 'availability', dim: 'weekday', measures: ['count', 'capacity', 'booked', 'util'] },
  { id: 'affiliate', title: 'Affiliate production', dataset: 'bookings', dim: 'affiliate', measures: ['count', 'pax', 'revenue'] },
  { id: 'outstanding', title: 'Outstanding balances', dataset: 'bookings', dim: 'item', measures: ['count', 'revenue', 'paid', 'balance'] },
  { id: 'fees', title: 'Processing fees', dataset: 'payments', dim: 'method', measures: ['count', 'amount', 'fee', 'net'] },
  { id: 'taxes', title: 'Taxes & fees collected', dataset: 'bookings', dim: 'month', measures: ['count', 'subtotal', 'tax', 'revenue'] },
  { id: 'promos', title: 'Promo code performance', dataset: 'bookings', dim: 'promo', measures: ['count', 'revenue', 'discount'] },
  { id: 'audience', title: 'Guest geography', dataset: 'contacts', dim: 'country', measures: ['count', 'bookings', 'ltv', 'avgLtv'] },
  { id: 'loyalty', title: 'Repeat rate', dataset: 'contacts', dim: 'frequency', measures: ['count', 'ltv', 'avgLtv'] },
  { id: 'staff', title: 'Bookings taken by staff', dataset: 'bookings', dim: 'user', measures: ['count', 'pax', 'revenue'] },
];

export default {
  id: 'reports',
  title: 'Reports',
  icon: '📊',
  group: 'Insights',
  order: 210,
  summary: 'A report builder over every dataset, plus the saved and scheduled reports the team relies on.',
  entities: ['booking', 'payment', 'payout', 'availability', 'contact', 'saved_report'],

  commands: () => PRESETS.slice(0, 6).map(p => ({ title: `Report: ${p.title}`, path: `/reports?preset=${p.id}` })),

  render(ctx) {
    const { db, router, route } = ctx;
    const datasets = DATASETS(ctx);
    const presetId = route.query.preset;
    const preset = PRESETS.find(p => p.id === presetId);

    const dsId = route.query.ds || preset?.dataset || 'bookings';
    const ds = datasets[dsId];
    const dimId = route.query.dim || preset?.dim || Object.keys(ds.dimensions)[0];
    const dim = ds.dimensions[dimId];
    const measureIds = (route.query.m || preset?.measures.join(',') || Object.keys(ds.measures).slice(0, 4).join(',')).split(',')
      .filter(m => ds.measures[m]);
    const range = rangeOf(ctx, 'range', '90d');
    const chartType = route.query.chart || 'bar';

    const rows = ds.rows(range.from, range.to);
    const groups = db.groupBy(rows, dim.of, {})
      .map(g => {
        const out = { key: g.key, items: g.items };
        for (const mid of measureIds) out[mid] = ds.measures[mid].of(g.items);
        return out;
      })
      .sort((a, b) => (b[measureIds[measureIds.length - 1]] ?? 0) - (a[measureIds[measureIds.length - 1]] ?? 0));

    const primary = measureIds.find(m => ds.measures[m].money) || measureIds[measureIds.length - 1];
    const chartData = groups.slice(0, 14).map(g => ({ label: F.truncate(String(g.key), 18), short: String(g.key).slice(0, 3), value: g[primary] || 0 }));

    /* time series across the range for the trend panel */
    const series = [];
    for (let d = range.from; d <= range.to; d = F.addDays(d, 1)) {
      const dayRows = rows.filter(r => ds.dateOf(r) === d);
      series.push({ label: d.slice(5), short: d.slice(8), value: ds.measures[primary].of(dayRows) });
    }

    const setQ = (patch) => router.patchQuery({ ...patch, preset: '' });

    const builder = card({ title: 'Report builder', sub: 'Pick a dataset, a dimension to group by, and the measures to total.' },
      h('div.grid.c4',
        h('div.field', h('label', 'Dataset'),
          select(Object.entries(datasets).map(([k, v]) => [k, v.label]), dsId,
            v => router.go('/reports', { ds: v, range: range.id })),
          h('div.hint', ds.desc)),
        h('div.field', h('label', 'Group by'),
          select(Object.entries(ds.dimensions).map(([k, v]) => [k, v.label]), dimId, v => setQ({ dim: v }))),
        h('div.field', h('label', 'Chart'),
          select([['bar', 'Bars'], ['rank', 'Ranked list'], ['donut', 'Donut'], ['trend', 'Trend over time']], chartType, v => setQ({ chart: v }))),
        h('div.field', h('label', 'Date range'), rangePicker(ctx, { defaultKey: '90d' }))),
      h('div.field.mt-4', h('label', 'Measures'),
        h('div.row', ...Object.entries(ds.measures).map(([mid, m]) => {
          const on = measureIds.includes(mid);
          const b = btn(m.label, { size: 'sm', onclick: () => {
            const next = on ? measureIds.filter(x => x !== mid) : [...measureIds, mid];
            if (next.length) setQ({ m: next.join(',') });
          } });
          if (on) b.classList.add('primary');
          return b;
        }))));

    const chart = {
      bar: () => barChart(chartData, { height: 230, money: ds.measures[primary].money }),
      rank: () => rankBars(chartData, { money: ds.measures[primary].money, limit: 14 }),
      donut: () => h('div.row', { style: { gap: '20px', alignItems: 'center' } },
        donut(chartData.slice(0, 8), {
          size: 190,
          centerLabel: ds.measures[primary].fmt(groups.reduce((s, g) => s + (g[primary] || 0), 0)),
          centerSub: ds.measures[primary].label,
        }),
        h('div', { style: { flex: 1 } }, legend(chartData.slice(0, 8).map(c => ({ label: c.label, value: ds.measures[primary].fmt(c.value) }))))),
      trend: () => barChart(series, { height: 230, money: ds.measures[primary].money }),
    }[chartType]();

    const totalsRow = measureIds.map(mid => ds.measures[mid].fmt(ds.measures[mid].of(rows)));

    const resultTable = simpleTable(
      [dim.label, ...measureIds.map(mid => ({ label: ds.measures[mid].label, align: 'num' }))],
      groups.map(g => [
        h('span.strong', String(g.key)),
        ...measureIds.map(mid => ds.measures[mid].fmt(g[mid])),
      ]),
      { footer: ['Total', ...totalsRow] });

    const saved = db.all('saved_report');

    return h('div.page',
      pageHead({
        title: 'Reports',
        sub: preset ? preset.title : `${ds.label} grouped by ${dim.label.toLowerCase()}`,
        actions: [
          btn('Save this report', { onclick: () => saveReport(ctx, { dsId, dimId, measureIds, range: range.id }) }),
          btn('Export CSV', { kind: 'primary', icon: '↓', onclick: () => exportReport(dim, ds, measureIds, groups) }),
        ],
      }),
      moduleIntro(this, 'Every preset below is the same engine with different arguments. Nothing here is a hard-coded screen — datasets, dimensions and measures are declared in one table at the top of this module.'),

      h('div.row.mb-4', ...PRESETS.map(p => {
        const b = btn(p.title, { size: 'sm', onclick: () => router.go('/reports', { preset: p.id, range: range.id }) });
        if (p.id === presetId) b.classList.add('primary');
        return b;
      })),

      builder,

      h('div.grid.c4.mt-4.mb-4',
        ...measureIds.slice(0, 4).map(mid => stat({
          label: ds.measures[mid].label,
          value: ds.measures[mid].fmt(ds.measures[mid].of(rows)),
          hint: `${F.num(rows.length)} rows in range`,
        }))),

      h('div.grid.side',
        h('div.col',
          card({ title: `${ds.measures[primary].label} by ${dim.label.toLowerCase()}`, sub: `${F.dateShort(range.from)} – ${F.dateShort(range.to)}` }, chart),
          card({ title: 'Results', sub: `${groups.length} groups`, flush: true },
            groups.length ? resultTable : empty('No rows in this range'))),
        h('div.col',
          card({ title: 'Saved reports', sub: 'Definitions, not snapshots', flush: true },
            simpleTable(['Report', 'Dataset', 'Delivery'],
              saved.map(s => [
                h('div', h('div.strong', s.name), h('div.small.muted', s.group_by ? `Grouped by ${s.group_by}` : 'Ungrouped')),
                F.titleCase(s.base),
                s.schedule === 'none' ? badge('Manual') : badge(F.titleCase(s.schedule), 'info'),
              ]))),
          card({ title: 'Scheduled delivery' },
            h('p.small.muted', 'A saved report can be emailed on a cadence. Recipients get a CSV plus a link back into the dashboard with the same filters applied.'),
            simpleTable(['Report', 'To'],
              saved.filter(s => s.schedule !== 'none').map(s => [s.name, h('span.small', (s.recipients || []).join(', ') || '—')]))),
          card({ title: 'What each dataset answers' },
            h('div.col', { style: { gap: '10px' } },
              ...Object.entries(datasets).map(([k, v]) => h('div',
                h('div.small.strong', v.label), h('div.small.muted', v.desc)))))))
    );
  },
};

function exportReport(dim, ds, measureIds, groups) {
  const head = [dim.label, ...measureIds.map(m => ds.measures[m].label)].join(',');
  const body = groups.map(g => [JSON.stringify(String(g.key)), ...measureIds.map(m => g[m])].join(',')).join('\n');
  const blob = new Blob([head + '\n' + body], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'report.csv';
  document.body.append(a); a.click(); a.remove();
  toast('Report exported', { detail: `${groups.length} rows`, tone: 'ok' });
}

function saveReport(ctx, cfg) {
  const { db } = ctx;
  let name = '', schedule = 'none', recipient = ctx.store.get('currentUser')?.email || '';
  modal({
    title: 'Save this report',
    sub: 'Saves the definition — dataset, grouping and measures — not a snapshot of the numbers.',
    render: () => h('div.col',
      h('div.field', h('label', 'Report name'),
        h('input.input', { placeholder: 'Weekly channel mix', oninput: e => { name = e.target.value; } })),
      h('div.field', h('label', 'Email delivery'),
        select([['none', 'Do not send'], ['daily', 'Every morning'], ['weekly', 'Every Monday'], ['monthly', 'First of the month']],
          schedule, v => { schedule = v; })),
      h('div.field', h('label', 'Send to'),
        h('input.input', { value: recipient, oninput: e => { recipient = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Save report', { kind: 'primary', onclick: () => {
        if (!name.trim()) return toast('Name the report', { tone: 'warn' });
        db.insert('saved_report', {
          company: ctx.domain.company().pk, name: name.trim(), base: cfg.dsId,
          columns: cfg.measureIds, filters: { range: cfg.range }, group_by: cfg.dimId,
          schedule, recipients: schedule === 'none' ? [] : [recipient],
          owner: ctx.store.get('currentUser')?.pk,
        });
        api.close(); toast('Report saved', { tone: 'ok' });
      } })],
  });
}
