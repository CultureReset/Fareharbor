import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, tabs, toggle, meter } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast } from '../core/ui/overlay.js';
import { rankBars, donut, legend, barChart, stackedBar, seriesColor } from '../core/ui/chart.js';
import { openBooking, moduleIntro, rangePicker, rangeOf } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'distribution',
  title: 'Affiliates & Channels',
  icon: '🤝',
  group: 'Distribution',
  order: 180,
  summary: 'Resellers, concierges and OTAs, their commission terms, and what each channel actually produces.',
  entities: ['affiliate', 'channel', 'booking'],

  render(ctx) {
    const { db, router, route } = ctx;
    const tab = route.query.tab || 'affiliates';
    const range = rangeOf(ctx, 'range', '90d');
    const affiliates = db.all('affiliate');
    const channels = db.all('channel');

    const bookings = db.where('booking', b => {
      const d = b.created_at.slice(0, 10);
      return d >= range.from && d <= range.to && b.status !== 'cancelled';
    });

    const channelStats = channels.map(c => {
      const rows = bookings.filter(b => b.channel === c.pk);
      return {
        channel: c, count: rows.length,
        revenue: rows.reduce((s, b) => s + b.total, 0),
        pax: rows.reduce((s, b) => s + b.pax, 0),
        avg: rows.length ? Math.round(rows.reduce((s, b) => s + b.total, 0) / rows.length) : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const totalRev = channelStats.reduce((s, c) => s + c.revenue, 0);
    const commissionOwed = affiliates.reduce((s, a) => s + a.commission_owed, 0);
    const affiliateRev = affiliates.reduce((s, a) => s + a.revenue_ytd, 0);

    const TABS = [
      { id: 'affiliates', title: 'Affiliates', count: affiliates.length },
      { id: 'channels', title: 'Channels', count: channels.length },
      { id: 'commission', title: 'Commission owed' },
    ];

    const panes = {
      affiliates: () => card({ flush: true }, dataTable({
        rows: affiliates,
        exportName: 'affiliates',
        defaultSort: 'revenue_ytd', defaultDir: 'desc',
        searchPlaceholder: 'Affiliate name or contact…',
        onRowClick: (a) => openAffiliate(ctx, a),
        columns: [
          { key: 'name', label: 'Affiliate', render: a => h('div',
            h('div.strong', a.name), h('div.small.muted', `${a.contact_name} · ${a.email}`)) },
          { key: 'kind', label: 'Type', render: a => badge(F.titleCase(a.kind), a.kind === 'network' ? 'purple' : '') },
          { key: 'commission_pct', label: 'Commission', align: 'num', fmt: v => F.pct(v, 0) },
          { key: 'payment_terms', label: 'Terms', render: a => h('span.small', F.titleCase(a.payment_terms)) },
          { key: 'bookings_ytd', label: 'Bookings YTD', align: 'num', fmt: F.num },
          { key: 'revenue_ytd', label: 'Revenue YTD', align: 'num', fmt: F.money },
          { key: 'commission_owed', label: 'Commission owed', align: 'num',
            render: a => a.commission_owed ? h('span.strong', { style: { color: 'var(--warn)' } }, F.money(a.commission_owed)) : '—' },
          { key: 'status', label: 'Status', render: a => statusBadge(a.status) },
        ],
        filters: [
          { key: 'kind', label: 'Any type', options: ['reseller', 'concierge', 'ota', 'network'].map(k => [k, F.titleCase(k)]) },
          { key: 'status', label: 'Any status', options: ['active', 'pending', 'paused'].map(k => [k, F.titleCase(k)]) },
        ],
        totals: (rows) => ({
          bookings_ytd: F.num(rows.reduce((s, a) => s + a.bookings_ytd, 0)),
          revenue_ytd: F.money(rows.reduce((s, a) => s + a.revenue_ytd, 0)),
          commission_owed: F.money(rows.reduce((s, a) => s + a.commission_owed, 0)),
        }),
      })),

      channels: () => h('div.col',
        card({ title: 'Channel performance', sub: `${F.dateShort(range.from)} – ${F.dateShort(range.to)}`, flush: true },
          simpleTable(
            ['Channel', 'Kind', { label: 'Bookings', align: 'num' }, { label: 'Guests', align: 'num' },
             { label: 'Revenue', align: 'num' }, { label: 'Average', align: 'num' }, { label: 'Share', align: 'num' }, 'Mix'],
            channelStats.map(c => [
              h('span.strong', c.channel.name),
              badge(F.titleCase(c.channel.kind)),
              F.num(c.count), F.num(c.pax), F.money(c.revenue), F.money(c.avg),
              F.pct(totalRev ? c.revenue / totalRev : 0, 1),
              h('div', { style: { minWidth: '90px' } }, meter(c.revenue, totalRev || 1, 'ok')),
            ]),
            { footer: ['Total', '', F.num(bookings.length), F.num(bookings.reduce((s, b) => s + b.pax, 0)),
                       F.money(totalRev), '', '100%', ''] })),
        card({ title: 'What each channel means' },
          simpleTable(['Channel kind', 'How a booking arrives'], [
            ['Direct online', 'A guest books through the Lightframe widget on your own website. No commission.'],
            ['Dashboard', 'Your team takes the booking by phone or at the desk. No commission.'],
            ['Kiosk', 'A guest books themselves on a front-desk tablet.'],
            ['Point of sale', 'Walk-up sale rung through a card terminal.'],
            ['Affiliate', 'A concierge or reseller books on the guest’s behalf and earns commission.'],
            ['OTA', 'An online marketplace sells a seat and remits net of its take rate.'],
            ['API', 'A partner system creates the booking programmatically.'],
          ]))),

      commission: () => card({ title: 'Commission owed by affiliate', flush: true },
        simpleTable(
          ['Affiliate', 'Terms', { label: 'Bookings YTD', align: 'num' }, { label: 'Revenue YTD', align: 'num' },
           { label: 'Rate', align: 'num' }, { label: 'Owed', align: 'num' }, ''],
          affiliates.filter(a => a.commission_owed > 0).sort((a, b) => b.commission_owed - a.commission_owed).map(a => [
            h('span.strong', a.name),
            h('span.small', F.titleCase(a.payment_terms)),
            F.num(a.bookings_ytd), F.money(a.revenue_ytd), F.pct(a.commission_pct, 0),
            h('span.strong', F.money(a.commission_owed)),
            btn('Mark settled', { size: 'sm', onclick: () => {
              db.update('affiliate', a.pk, { commission_owed: 0 });
              toast(`${a.name} settled`, { detail: F.money(a.commission_owed), tone: 'ok' });
            } }),
          ]),
          { footer: ['Total owed', '', '', '', '', F.money(commissionOwed), ''] })),
    };

    return h('div.page',
      pageHead({
        title: 'Affiliates & Channels',
        sub: 'Every route a booking can take to reach you, and what each one costs.',
        actions: [rangePicker(ctx, { defaultKey: '90d' }), btn('Add affiliate', { kind: 'primary', icon: '＋', onclick: () => editAffiliate(ctx, null) })],
      }),
      moduleIntro(this, 'Every booking carries a channel; affiliate bookings additionally carry the affiliate. Commission is computed from the affiliate’s rate against booking value, then settled either net at payout or by monthly invoice.'),
      h('div.grid.c5.mb-4',
        stat({ label: 'Active affiliates', value: F.num(affiliates.filter(a => a.status === 'active').length) }),
        stat({ label: 'Affiliate revenue YTD', value: F.money(affiliateRev) }),
        stat({ label: 'Commission owed', value: F.money(commissionOwed), tone: 'warn' }),
        stat({ label: 'Direct share',
          value: F.pct(totalRev ? channelStats.filter(c => ['direct_online', 'dashboard', 'kiosk', 'pos'].includes(c.channel.kind)).reduce((s, c) => s + c.revenue, 0) / totalRev : 0, 0),
          hint: 'Revenue you keep in full' }),
        stat({ label: 'Blended take rate',
          value: F.pct(affiliateRev ? commissionOwed / affiliateRev : 0, 1) })),
      h('div.grid.side.mb-4',
        card({ title: 'Revenue by channel', sub: `${F.dateShort(range.from)} – ${F.dateShort(range.to)}` },
          rankBars(channelStats.map(c => ({ label: c.channel.name, value: c.revenue })))),
        card({ title: 'Share of revenue' },
          h('div.row', { style: { gap: '16px', alignItems: 'center' } },
            donut(channelStats.map(c => ({ label: c.channel.name, value: c.revenue })),
              { centerLabel: F.moneyShort(totalRev), centerSub: 'in range' }),
            h('div', { style: { flex: 1 } },
              legend(channelStats.map(c => ({ label: c.channel.name, value: F.pct(totalRev ? c.revenue / totalRev : 0, 0) }))))))),
      tabs(TABS, tab, id => router.patchQuery({ tab: id })),
      h('div.mt-4', panes[tab]()));
  },
};

function openAffiliate(ctx, a) {
  const { db } = ctx;
  const bookings = db.where('booking', b => b.affiliate === a.pk);
  const active = bookings.filter(b => b.status !== 'cancelled');
  const byItem = db.groupBy(active, b => db.label('item', b.item), { total: rs => rs.reduce((s, x) => s + x.total, 0) })
    .map(g => ({ label: g.key, value: g.total })).sort((x, y) => y.value - x.value);
  drawer({
    width: 'wide',
    title: a.name,
    sub: `${F.titleCase(a.kind)} · ${F.pct(a.commission_pct, 0)} commission · ${F.titleCase(a.payment_terms)}`,
    badge: statusBadge(a.status),
    render: (api) => h('div.col', { style: { gap: 'var(--sp-4)' } },
      h('div.grid.c4',
        h('div.stat', h('div.stat__label', 'Bookings YTD'), h('div.stat__value', F.num(a.bookings_ytd))),
        h('div.stat', h('div.stat__label', 'Revenue YTD'), h('div.stat__value', F.moneyShort(a.revenue_ytd))),
        h('div.stat', h('div.stat__label', 'Commission owed'), h('div.stat__value', F.moneyShort(a.commission_owed))),
        h('div.stat', h('div.stat__label', 'Average booking'),
          h('div.stat__value', F.moneyShort(active.length ? a.revenue_ytd / active.length : 0)))),
      card({ title: 'Agreement' }, h('div.grid.c2',
        h('div.field', h('label', 'Affiliate name'), h('input.input', { value: a.name, onchange: e => db.update('affiliate', a.pk, { name: e.target.value }) })),
        h('div.field', h('label', 'Type'), select(['reseller', 'concierge', 'ota', 'network'], a.kind, v => db.update('affiliate', a.pk, { kind: v }))),
        h('div.field', h('label', 'Commission rate'),
          h('input.input', { type: 'number', step: '0.01', value: a.commission_pct,
            onchange: e => db.update('affiliate', a.pk, { commission_pct: Number(e.target.value) }) })),
        h('div.field', h('label', 'Payment terms'),
          select([['net_of_commission', 'Deducted at payout'], ['invoice_monthly', 'Invoiced monthly'], ['prepaid', 'Prepaid balance']],
            a.payment_terms, v => db.update('affiliate', a.pk, { payment_terms: v }))),
        h('div.field', h('label', 'Contact'), h('input.input', { value: a.contact_name, onchange: e => db.update('affiliate', a.pk, { contact_name: e.target.value }) })),
        h('div.field', h('label', 'Email'), h('input.input', { value: a.email, onchange: e => db.update('affiliate', a.pk, { email: e.target.value }) })),
        h('div.field', h('label', 'Status'), select(['active', 'pending', 'paused'], a.status, v => { db.update('affiliate', a.pk, { status: v }); api.refresh(); })))),
      byItem.length ? card({ title: 'What they sell' }, rankBars(byItem, { limit: 8 })) : null,
      card({ title: 'Their booking link' },
        h('p.small.muted', 'Give the affiliate this link. Bookings made through it are automatically attributed and commissioned.'),
        h('pre.code-block', `https://fareharbor.com/${ctx.domain.company()?.shortname}/?ref=${a.pk}`)),
      card({ title: `Recent bookings (${bookings.length})`, flush: true },
        bookings.length ? simpleTable(
          ['Confirmation', 'Guest', 'Item', { label: 'Total', align: 'num' }, { label: 'Commission', align: 'num' }, 'Status', ''],
          bookings.slice(-25).reverse().map(b => [
            h('span.mono', b.code), db.label('contact', b.contact), db.label('item', b.item),
            F.money(b.total), F.money(Math.round(b.total * a.commission_pct)), statusBadge(b.status),
            btn('Open', { size: 'sm', onclick: () => openBooking(ctx, b) }),
          ])) : empty('No bookings yet'))),
    foot: (api) => a.commission_owed > 0
      ? [btn(`Settle ${F.money(a.commission_owed)}`, { kind: 'primary', onclick: () => {
          db.update('affiliate', a.pk, { commission_owed: 0 }); api.refresh(); toast('Commission settled', { tone: 'ok' });
        } })]
      : null,
  });
}

function editAffiliate(ctx, a) {
  const { db } = ctx;
  const d = { name: '', kind: 'reseller', contact_name: '', email: '', phone: '', commission_pct: 0.15, payment_terms: 'net_of_commission' };
  modal({
    title: 'Add an affiliate',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Affiliate name'),
        h('input.input', { placeholder: 'Harbourside Concierge', oninput: e => { d.name = e.target.value; } })),
      h('div.field', h('label', 'Type'), select(['reseller', 'concierge', 'ota', 'network'], d.kind, v => { d.kind = v; })),
      h('div.field', h('label', 'Commission rate (0.15 = 15%)'),
        h('input.input', { type: 'number', step: '0.01', value: d.commission_pct, oninput: e => { d.commission_pct = Number(e.target.value); } })),
      h('div.field', h('label', 'Contact name'), h('input.input', { oninput: e => { d.contact_name = e.target.value; } })),
      h('div.field', h('label', 'Email'), h('input.input', { type: 'email', oninput: e => { d.email = e.target.value; } })),
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Payment terms'),
        select([['net_of_commission', 'Deducted at payout'], ['invoice_monthly', 'Invoiced monthly'], ['prepaid', 'Prepaid balance']], d.payment_terms, v => { d.payment_terms = v; }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Add affiliate', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name the affiliate', { tone: 'warn' });
        db.insert('affiliate', { company: ctx.domain.company().pk, ...d,
          bookings_ytd: 0, revenue_ytd: 0, commission_owed: 0, status: 'pending' });
        api.close(); toast('Affiliate added as pending', { tone: 'ok' });
      } })],
  });
}
