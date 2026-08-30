import { h } from '../core/dom.js';
import { pageHead, card, btn, stat, badge, statusBadge, meter, empty, avatar, timeline } from '../core/ui/kit.js';
import { sparkline, barChart, rankBars, donut, legend, seriesColor } from '../core/ui/chart.js';
import { openBooking, moduleIntro, rangePicker, rangeOf, capacityCell } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'home',
  title: 'Home',
  icon: '🏠',
  group: 'Overview',
  order: 10,
  summary: "The operator's landing screen: today's numbers, what needs attention, and the live activity feed.",
  entities: ['booking', 'payment', 'availability', 'task', 'activity_log'],

  render(ctx) {
    const { db, domain, router, store } = ctx;
    const me = store.get('currentUser');
    const range = rangeOf(ctx, 'range', '30d');
    const m = domain.metrics(range.from, range.to);
    const series = domain.series(range.from, range.to);
    const t = F.today();

    /* ------------------------------------------------- today's board */
    const board = domain.dayBoard(t);
    const todayPax = board.reduce((s, d) => s + d.pax, 0);
    const todayCap = board.reduce((s, d) => s + d.availability.capacity, 0);

    /* ----------------------------------------------------- worklists */
    const balances = domain.outstandingBalances().slice(0, 6);
    const waivers = domain.missingWaivers().filter(b => {
      const a = db.get('availability', b.availability);
      return a && a.date >= t && a.date <= F.addDays(t, 7);
    }).slice(0, 6);
    const unassigned = domain.unassignedDepartures(t, F.addDays(t, 7)).slice(0, 6);
    const openTasks = db.where('task', x => x.status === 'open' || x.status === 'in_progress');

    /* ------------------------------------------------------ breakdowns */
    const byChannel = db.groupBy(m.now.rows, r => db.label('channel', r.channel), { total: rs => rs.reduce((s, x) => s + x.total, 0) })
      .sort((a, b) => b.total - a.total)
      .map(g => ({ label: g.key, value: g.total, count: g.count }));
    const byItem = db.groupBy(m.now.rows, r => db.label('item', r.item), { total: rs => rs.reduce((s, x) => s + x.total, 0) })
      .sort((a, b) => b.total - a.total)
      .map(g => ({ label: g.key, value: g.total }));

    const worklist = (title, rows, renderRow, viewAll) => card({
      title, sub: rows.length ? `${rows.length} shown` : null,
      actions: viewAll && [btn('View all', { size: 'sm', kind: 'ghost', onclick: viewAll })],
      flush: true,
    }, rows.length
      ? h('div', ...rows.map(renderRow))
      : h('div.dt__empty', h('div.strong', 'All clear'), h('div.small.mt-2', 'Nothing needs attention here.')));

    const rowLink = (left, right, onclick) => h('button', {
      onclick,
      style: {
        display: 'flex', width: '100%', gap: '12px', alignItems: 'center', textAlign: 'left',
        padding: '9px 16px', border: 0, borderBottom: '1px solid var(--border)',
        background: 'none', cursor: 'pointer', fontSize: 'var(--fs-md)',
      },
    }, h('div', { style: { flex: 1, minWidth: 0 } }, left), right);

    return h('div.page',
      pageHead({
        title: `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${me?.name.split(' ')[0]}`,
        sub: `${F.dateLong(t)} · ${domain.company()?.name}`,
        actions: [rangePicker(ctx), btn('New booking', { kind: 'primary', icon: '＋', onclick: () => router.go('/book') })],
      }),
      moduleIntro(this, 'Every number here is computed live from the same tables the rest of the dashboard reads. Change the range and everything recalculates.'),

      /* -------------------------------------------------------- KPIs */
      h('div.grid.c5.mb-4',
        stat({
          label: 'Booked revenue', value: F.money(m.now.revenue), delta: m.delta('revenue'),
          spark: sparkline(series.map(s => s.value), { w: 150 }),
        }),
        stat({ label: 'Bookings', value: F.num(m.now.bookings), delta: m.delta('bookings'),
          spark: sparkline(series.map(s => s.count), { w: 150, tone: 'var(--purple)' }) }),
        stat({ label: 'Guests', value: F.num(m.now.pax), delta: m.delta('pax') }),
        stat({ label: 'Average booking', value: F.money(m.now.avgValue), delta: m.delta('avgValue') }),
        stat({ label: 'Capacity used', value: F.pct(m.now.utilisation, 1),
          hint: `${F.num(m.now.seatsSold)} of ${F.num(m.now.capacity)} seats on ${F.num(m.now.departures)} departures`,
          spark: meter(m.now.seatsSold, m.now.capacity) })),

      h('div.grid.side.mb-4',
        card({
          title: 'Booking value by day',
          sub: `${F.dateShort(range.from)} – ${F.dateShort(range.to)}`,
          actions: [btn('Open reports', { size: 'sm', onclick: () => router.go('/reports') })],
        }, barChart(series.map(s => ({
          label: s.date.slice(5), short: s.date.slice(8), value: s.value,
          dim: s.date === t,
        })), { height: 210 })),

        card({ title: 'Where bookings come from', sub: 'By value, this period' },
          h('div.row', { style: { gap: '18px', alignItems: 'center' } },
            donut(byChannel.slice(0, 6), {
              centerLabel: F.num(m.now.bookings), centerSub: 'bookings',
            }),
            h('div', { style: { flex: 1 } }, legend(byChannel.slice(0, 6).map(c => ({ label: c.label, value: F.moneyShort(c.value) })))))) ),

      /* ------------------------------------------------------- today */
      h('div.grid.side.mb-4',
        card({
          title: `Today — ${board.length} departure${board.length === 1 ? '' : 's'}`,
          sub: `${todayPax} of ${todayCap} seats sold`,
          actions: [btn('Open day view', { size: 'sm', onclick: () => router.go('/today') })],
          flush: true,
        }, board.length ? h('div.dt__scroll', h('table.dt__table',
          h('thead', h('tr', h('th', 'Time'), h('th', 'Item'), h('th', 'Capacity'),
            h('th', 'Crew & craft'), h('th.num', 'Checked in'), h('th', ''))),
          h('tbody', ...board.map(d => h('tr.clickable', {
            onclick: () => router.go(`/checkin/departure/${d.availability.pk}`),
          },
            h('td.nowrap.strong', F.time12(d.availability.start_time)),
            h('td', h('div', d.item?.name), h('div.small.muted', db.label('location', d.item?.location))),
            h('td', { style: { width: '150px' } }, capacityCell(ctx, d.availability)),
            h('td.small', d.resources.length
              ? d.resources.map(r => r.resource?.name).join(', ')
              : h('span', { style: { color: 'var(--warn)' } }, 'Unassigned')),
            h('td.num', `${d.checkedIn}/${d.bookings.length}`),
            h('td', btn('Manifest', { size: 'sm' })))))))
          : empty('Nothing scheduled today', 'No departures fall on this date.')),

        h('div.col',
          card({ title: 'Needs attention' },
            h('div.col', { style: { gap: '10px' } },
              attentionRow('💰', `${F.num(domain.outstandingBalances().length)} bookings with a balance`,
                F.money(domain.outstandingBalances().reduce((s, b) => s + b.balance, 0)),
                () => router.go('/bookings', { view: 'balance' })),
              attentionRow('✍', `${F.num(domain.missingWaivers().length)} waivers outstanding`, 'Chase before departure',
                () => router.go('/bookings', { view: 'waivers' })),
              attentionRow('🚐', `${F.num(domain.unassignedDepartures(t, F.addDays(t, 7)).length)} departures without crew`, 'Next 7 days',
                () => router.go('/resources')),
              attentionRow('✅', `${F.num(openTasks.length)} open tasks`,
                `${openTasks.filter(x => x.priority === 'urgent' || x.priority === 'high').length} high priority`,
                () => router.go('/tasks')),
              attentionRow('🔌', `${F.num(db.where('webhook', w => w.status === 'failing').length)} failing webhooks`, 'Integrations',
                () => router.go('/integrations')))),
          card({ title: 'Top items this period' }, rankBars(byItem, { limit: 6 })))),

      /* ---------------------------------------------------- worklists */
      h('div.grid.c3.mb-4',
        worklist('Balances to collect', balances,
          b => rowLink(
            h('div', h('div.strong', db.label('contact', b.contact)),
              h('div.small.muted', `${b.code} · ${db.label('item', b.item)}`)),
            h('span.strong', { style: { color: 'var(--danger)' } }, F.money(b.balance)),
            () => openBooking(ctx, b)),
          () => router.go('/bookings', { view: 'balance' })),

        worklist('Waivers due this week', waivers,
          b => rowLink(
            h('div', h('div.strong', db.label('contact', b.contact)),
              h('div.small.muted', `${db.label('item', b.item)} · ${F.dateShort(db.get('availability', b.availability)?.date)}`)),
            statusBadge(b.waiver_status),
            () => openBooking(ctx, b)),
          () => router.go('/waivers')),

        worklist('Departures without crew', unassigned,
          a => rowLink(
            h('div', h('div.strong', db.label('item', a.item)),
              h('div.small.muted', `${F.dateMed(a.date)} · ${F.time12(a.start_time)}`)),
            badge(`${a.booked} pax`, 'warn'),
            () => router.go(`/checkin/departure/${a.pk}`)),
          () => router.go('/resources'))),

      /* ------------------------------------------------- activity feed */
      card({
        title: 'Recent activity',
        sub: 'Every write in the dashboard lands in the audit log',
        actions: [btn('Full log', { size: 'sm', kind: 'ghost', onclick: () => router.go('/activity') })],
      }, timeline(db.all('activity_log').slice(0, 10).map(a => ({
        title: `${db.label('user', a.actor)} ${a.detail}`,
        detail: `${a.action} · ${a.target}`,
        when: F.relative(a.created_at),
        tone: a.action.includes('cancel') || a.action.includes('delete') ? 'danger'
          : a.action.includes('create') ? 'ok' : 'info',
      })))));

    function attentionRow(icon, title, sub, onclick) {
      return h('button', {
        onclick,
        style: {
          display: 'flex', gap: '10px', alignItems: 'center', width: '100%', textAlign: 'left',
          padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          background: 'var(--surface-2)', cursor: 'pointer',
        },
      }, h('span', { style: { fontSize: '16px' } }, icon),
         h('div', { style: { flex: 1, minWidth: 0 } },
           h('div.small.strong', title), h('div.small.muted', sub)),
         h('span.subtle', '›'));
    }
  },
};
