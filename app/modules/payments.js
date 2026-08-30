import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, simpleTable, kv } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast } from '../core/ui/overlay.js';
import { barChart, rankBars, donut, legend } from '../core/ui/chart.js';
import { openBooking, moduleIntro, rangePicker, rangeOf } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'payments',
  title: 'Payments',
  icon: '💳',
  group: 'Money',
  order: 160,
  summary: 'Every charge, refund, void and chargeback, with the processing fees attached.',
  entities: ['payment', 'booking'],

  badge: (ctx) => ctx.db.where('payment', p => p.status === 'disputed').length || null,

  render(ctx) {
    const { db, router } = ctx;
    const range = rangeOf(ctx, 'range', '30d');
    const inRange = db.where('payment', p => {
      const d = p.created_at.slice(0, 10);
      return d >= range.from && d <= range.to;
    });

    const charges = inRange.filter(p => p.kind === 'charge');
    const refunds = inRange.filter(p => p.kind === 'refund');
    const disputes = db.where('payment', p => p.status === 'disputed');
    const gross = charges.reduce((s, p) => s + p.amount, 0);
    const refunded = -refunds.reduce((s, p) => s + p.amount, 0);
    const fees = inRange.reduce((s, p) => s + p.fee, 0);

    const byMethod = db.groupBy(charges, p => F.titleCase(p.method), { total: rs => rs.reduce((s, x) => s + x.amount, 0) })
      .map(g => ({ label: g.key, value: g.total })).sort((a, b) => b.value - a.value);

    const daily = [];
    for (let d = range.from; d <= range.to; d = F.addDays(d, 1)) {
      const rows = inRange.filter(p => p.created_at.slice(0, 10) === d);
      daily.push({ label: d.slice(5), short: d.slice(8), value: rows.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0) });
    }

    const table = dataTable({
      rows: inRange,
      exportName: `payments-${range.from}-to-${range.to}`,
      defaultSort: 'created_at', defaultDir: 'desc',
      searchPlaceholder: 'Processor reference or card last 4…',
      onRowClick: (p) => p.booking && openBooking(ctx, p.booking),
      columns: [
        { key: 'created_at', label: 'Processed', nowrap: true, render: p => h('div',
          h('div', F.dateShort(p.created_at.slice(0, 10))), h('div.small.muted', F.relative(p.created_at))) },
        { key: 'booking', label: 'Booking', value: p => db.label('booking', p.booking),
          render: p => h('div', h('span.mono', db.label('booking', p.booking)),
            h('div.small.muted', db.label('contact', db.get('booking', p.booking)?.contact))) },
        { key: 'kind', label: 'Type', render: p => statusBadge(p.kind) },
        { key: 'method', label: 'Method', render: p => p.card_last4
          ? h('div', h('div', p.card_brand), h('div.small.muted', `····${p.card_last4}`))
          : F.titleCase(p.method) },
        { key: 'amount', label: 'Amount', align: 'num',
          render: p => h('span', { style: { color: p.amount < 0 ? 'var(--danger)' : null, fontWeight: 600 } }, F.money(p.amount)) },
        { key: 'fee', label: 'Fee', align: 'num', render: p => h('span.muted', F.money(p.fee, { blankZero: true })) },
        { key: 'net', label: 'Net', align: 'num', fmt: F.money },
        { key: 'status', label: 'Status', render: p => statusBadge(p.status) },
        { key: 'payout', label: 'Payout', value: p => db.label('payout', p.payout),
          render: p => p.payout ? h('a.small.mono', { href: `#/payouts/detail/${p.payout}` }, db.label('payout', p.payout))
            : badge('Unsettled', 'warn') },
      ],
      filters: [
        { key: 'kind', label: 'Any type', options: ['charge', 'refund', 'void', 'chargeback', 'adjustment'].map(k => [k, F.titleCase(k)]) },
        { key: 'method', label: 'Any method', options: ['card', 'cash', 'check', 'gift_card', 'invoice', 'apple_pay', 'terminal'].map(k => [k, F.titleCase(k)]) },
        { key: 'status', label: 'Any status', options: ['succeeded', 'pending', 'failed', 'refunded', 'disputed'].map(k => [k, F.titleCase(k)]) },
        { key: 'settled', label: 'Any settlement', options: [['yes', 'In a payout'], ['no', 'Not yet settled']],
          apply: (r, v) => v === 'yes' ? !!r.payout : !r.payout },
      ],
      totals: (rows) => ({
        amount: F.money(rows.reduce((s, p) => s + p.amount, 0)),
        fee: F.money(rows.reduce((s, p) => s + p.fee, 0)),
        net: F.money(rows.reduce((s, p) => s + p.net, 0)),
      }),
    });

    return h('div.page',
      pageHead({
        title: 'Payments',
        sub: 'The transaction ledger. Every row belongs to a booking and eventually to a payout.',
        actions: [rangePicker(ctx)],
      }),
      moduleIntro(this, 'FareHarbor processes card payments as merchant of record: the gross is collected here, fees are deducted, and the remainder settles in a payout batch.'),
      h('div.grid.c5.mb-4',
        stat({ label: 'Gross charged', value: F.money(gross), hint: `${charges.length} charges` }),
        stat({ label: 'Refunded', value: F.money(refunded), tone: refunded ? 'danger' : null, hint: `${refunds.length} refunds` }),
        stat({ label: 'Processing fees', value: F.money(fees),
          hint: gross ? `${F.pct(fees / gross, 2)} of gross` : null }),
        stat({ label: 'Net', value: F.money(gross - refunded - fees) }),
        stat({ label: 'Open disputes', value: F.num(disputes.length), tone: disputes.length ? 'danger' : null })),
      disputes.length ? h('div.banner.danger.mb-4', h('span', '⚠'),
        h('div', h('div.strong', `${disputes.length} chargeback${disputes.length === 1 ? '' : 's'} need a response`),
          h('div.small', `${F.money(-disputes.reduce((s, p) => s + p.amount, 0))} at risk. Respond with the manifest, waiver and check-in record as evidence.`)),
        h('div.spacer'),
        btn('Review', { size: 'sm', onclick: () => ctx.router.patchQuery({}) })) : null,
      h('div.grid.side.mb-4',
        card({ title: 'Collected by day', sub: `${F.dateShort(range.from)} – ${F.dateShort(range.to)}` },
          barChart(daily, { height: 190 })),
        card({ title: 'By payment method' },
          h('div.row', { style: { gap: '16px', alignItems: 'center' } },
            donut(byMethod, { centerLabel: F.moneyShort(gross), centerSub: 'collected' }),
            h('div', { style: { flex: 1 } }, legend(byMethod.map(m => ({ label: m.label, value: F.moneyShort(m.value) }))))))),
      card({ flush: true }, table));
  },
};
