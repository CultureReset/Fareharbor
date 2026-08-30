import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, simpleTable, kv } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, toast } from '../core/ui/overlay.js';
import { barChart } from '../core/ui/chart.js';
import { openBooking, moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'payouts',
  title: 'Payouts',
  icon: '🏦',
  group: 'Money',
  order: 170,
  summary: 'Settlement batches to the bank account, and the reconciliation from gross sales to net paid.',
  entities: ['payout', 'payment'],

  render(ctx) {
    const { db, router, route } = ctx;
    if (route.sub === 'detail' && route.id) setTimeout(() => openPayout(ctx, route.id), 0);

    const payouts = db.all('payout').sort((a, b) => b.period_end.localeCompare(a.period_end));
    const paid = payouts.filter(p => p.status === 'paid');
    const pending = payouts.filter(p => p.status !== 'paid');
    const unsettled = db.where('payment', p => !p.payout && p.status === 'succeeded' && p.method !== 'invoice');

    const table = dataTable({
      rows: payouts,
      exportName: 'payouts',
      defaultSort: 'period_end', defaultDir: 'desc',
      searchPlaceholder: 'Payout reference…',
      onRowClick: (p) => router.go(`/payouts/detail/${p.pk}`),
      columns: [
        { key: 'reference', label: 'Reference', render: p => h('span.mono.strong', p.reference) },
        { key: 'period_start', label: 'Period', value: p => p.period_start,
          render: p => `${F.dateShort(p.period_start)} – ${F.dateShort(p.period_end)}` },
        { key: 'transaction_count', label: 'Transactions', align: 'num' },
        { key: 'gross', label: 'Gross', align: 'num', fmt: F.money },
        { key: 'refunds', label: 'Refunds', align: 'num',
          render: p => h('span', { style: { color: p.refunds ? 'var(--danger)' : null } }, F.money(p.refunds, { blankZero: true })) },
        { key: 'fees', label: 'Fees', align: 'num', render: p => h('span.muted', '−' + F.money(p.fees)) },
        { key: 'adjustments', label: 'Adjustments', align: 'num', fmt: (v) => F.money(v, { blankZero: true }) },
        { key: 'net', label: 'Net paid', align: 'num', render: p => h('span.strong', F.money(p.net)) },
        { key: 'status', label: 'Status', render: p => statusBadge(p.status) },
        { key: 'paid_on', label: 'Paid on', render: p => p.paid_on ? F.dateShort(p.paid_on) : '—' },
      ],
      filters: [{ key: 'status', label: 'Any status', options: ['paid', 'in_transit', 'scheduled', 'failed'].map(s => [s, F.titleCase(s)]) }],
      totals: (rows) => ({
        gross: F.money(rows.reduce((s, p) => s + p.gross, 0)),
        fees: F.money(rows.reduce((s, p) => s + p.fees, 0)),
        net: F.money(rows.reduce((s, p) => s + p.net, 0)),
      }),
    });

    const chart = payouts.slice(0, 16).reverse()
      .map(p => ({ label: p.period_end.slice(5), short: p.period_end.slice(8), value: p.net }));

    return h('div.page',
      pageHead({
        title: 'Payouts',
        sub: 'Money leaving FareHarbor for your bank account. Each batch reconciles to a set of payments.',
      }),
      moduleIntro(this, 'The chain is: booking → payment → payout. A payment with no payout is money collected but not yet settled.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Paid out (all time)', value: F.money(paid.reduce((s, p) => s + p.net, 0)) }),
        stat({ label: 'In transit / scheduled', value: F.money(pending.reduce((s, p) => s + p.net, 0)), tone: 'warn' }),
        stat({ label: 'Fees withheld', value: F.money(payouts.reduce((s, p) => s + p.fees, 0)) }),
        stat({ label: 'Not yet in a payout', value: F.money(unsettled.reduce((s, p) => s + p.net, 0)),
          hint: `${unsettled.length} transactions` })),
      h('div.grid.side.mb-4',
        card({ title: 'Net paid per settlement period' }, barChart(chart, { height: 180 })),
        card({ title: 'Bank account' }, kv([
          ['Account', h('span.mono', `····${payouts[0]?.bank_last4 || '----'}`)],
          ['Schedule', 'Weekly, every Monday'],
          ['Currency', 'USD'],
          ['Next payout', pending.length ? F.dateShort(F.addDays(pending[0].period_end, 3)) : '—'],
          ['Hold policy', 'Funds settle 3 business days after the period closes'],
        ]), h('div.mt-3', btn('Change bank details', { size: 'sm', onclick: () => ctx.router.go('/settings', { section: 'payments' }) })))),
      card({ flush: true }, table));
  },
};

function openPayout(ctx, pk) {
  const { db } = ctx;
  const p = db.get('payout', pk);
  if (!p) return;
  const lines = db.where('payment', x => x.payout === pk);
  drawer({
    width: 'wide',
    title: p.reference,
    sub: `${F.dateShort(p.period_start)} – ${F.dateShort(p.period_end)} · ${lines.length} transactions`,
    badge: statusBadge(p.status),
    render: () => h('div.col', { style: { gap: 'var(--sp-4)' } },
      card({ title: 'Reconciliation' },
        h('dl.kv',
          h('dt', 'Gross sales'), h('dd.right', F.money(p.gross)),
          h('dt', 'Refunds'), h('dd.right', { style: { color: 'var(--danger)' } }, F.money(p.refunds, { blankZero: true })),
          h('dt', 'Processing fees'), h('dd.right', '−' + F.money(p.fees)),
          h('dt', 'Adjustments'), h('dd.right', F.money(p.adjustments, { blankZero: true })),
          h('dt', { style: { fontWeight: 700, color: 'var(--fg)' } }, 'Net paid'),
          h('dd.right.strong', F.money(p.net)))),
      card({ title: `Transactions in this payout (${lines.length})`, flush: true },
        lines.length ? simpleTable(
          ['Date', 'Booking', 'Type', 'Method', { label: 'Amount', align: 'num' },
           { label: 'Fee', align: 'num' }, { label: 'Net', align: 'num' }],
          lines.slice(0, 200).map(x => [
            F.dateShort(x.created_at.slice(0, 10)),
            h('a.mono', { href: `#/bookings/detail/${x.booking}` }, db.label('booking', x.booking)),
            statusBadge(x.kind),
            x.card_last4 ? `${x.card_brand} ····${x.card_last4}` : F.titleCase(x.method),
            F.money(x.amount), F.money(x.fee, { blankZero: true }), F.money(x.net),
          ])) : empty('No transactions attached'))),
    foot: () => [btn('Download statement', { icon: '↓', onclick: () => toast('Statement exported', { tone: 'ok' }) })],
  });
}
