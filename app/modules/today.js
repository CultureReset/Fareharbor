import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, meter, simpleTable, avatar } from '../core/ui/kit.js';
import { toast, drawer } from '../core/ui/overlay.js';
import { openBooking, moduleIntro, capacityCell } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'today',
  title: 'Today',
  icon: '📋',
  group: 'Overview',
  order: 20,
  summary: 'Every departure happening on one day in time order, with headcount, crew, check-in state and outstanding items.',
  entities: ['availability', 'booking', 'resource_assignment', 'checkin'],

  badge: (ctx) => ctx.domain.dayBoard(F.today()).length || null,

  commands: () => [{ title: 'Jump to today’s departures', path: '/today' }],

  render(ctx) {
    const { db, domain, router, route } = ctx;
    const date = route.query.date || F.today();
    const board = domain.dayBoard(date);
    const live = board.filter(d => d.availability.status !== 'cancelled');

    const pax = live.reduce((s, d) => s + d.pax, 0);
    const cap = live.reduce((s, d) => s + d.availability.capacity, 0);
    const revenue = live.reduce((s, d) => s + d.bookings.reduce((x, b) => x + b.total, 0), 0);
    const dueAtDesk = live.reduce((s, d) => s + d.bookings.reduce((x, b) => x + b.balance, 0), 0);
    const unassigned = live.filter(d => d.resources.length === 0 && d.pax > 0);

    const nav = (delta) => () => router.go('/today', { date: F.addDays(date, delta) });

    /* hour-by-hour rail so the shape of the day is visible at a glance */
    const hours = [...new Set(live.map(d => Number(d.availability.start_time.slice(0, 2))))].sort((a, b) => a - b);
    const rail = hours.length ? card({ title: 'Shape of the day', flush: true },
      h('div', { style: { display: 'flex', gap: '2px', padding: '14px 16px', alignItems: 'flex-end', height: '110px' } },
        ...Array.from({ length: 16 }, (_, i) => i + 6).map(hr => {
          const at = live.filter(d => Number(d.availability.start_time.slice(0, 2)) === hr);
          const p = at.reduce((s, d) => s + d.pax, 0);
          const maxP = Math.max(1, ...hours.map(x => live.filter(d => Number(d.availability.start_time.slice(0, 2)) === x).reduce((s, d) => s + d.pax, 0)));
          return h('div', { style: { flex: 1, textAlign: 'center' }, title: `${F.time12(F.pad(hr) + ':00')} — ${p} guests across ${at.length} departures` },
            h('div', { style: { height: '70px', display: 'flex', alignItems: 'flex-end' } },
              h('div', { style: { width: '100%', height: `${(p / maxP) * 100}%`, background: p ? 'var(--primary)' : 'var(--surface-3)', borderRadius: '3px 3px 0 0', minHeight: '2px' } })),
            h('div.small.subtle', { style: { fontSize: '9px', marginTop: '4px' } }, F.time12(F.pad(hr) + ':00').replace(':00', '')));
        }))) : null;

    const rows = live.map(d => {
      const av = d.availability;
      const outstanding = d.bookings.reduce((s, b) => s + b.balance, 0);
      const waiversOut = d.bookings.filter(b => ['pending', 'partial'].includes(b.waiver_status)).length;
      return [
        h('div', h('div.strong.nowrap', F.time12(av.start_time)),
          h('div.small.muted', `${F.duration(d.item?.duration_minutes)}`)),
        h('div', h('div.strong', d.item?.name),
          h('div.small.muted', db.label('location', d.item?.location))),
        capacityCell(ctx, av),
        h('div.small', d.resources.length
          ? d.resources.map(r => h('div', `${r.resource?.name} `, badge(r.role, r.status === 'tentative' ? 'warn' : '')))
          : btn('Assign', { size: 'sm', kind: 'danger', onclick: () => router.go('/resources', { date, availability: av.pk }) })),
        h('div', h('div.strong', `${d.checkedIn}/${d.bookings.length}`),
          meter(d.checkedIn, Math.max(1, d.bookings.length))),
        h('div.col', { style: { gap: '3px' } },
          outstanding > 0 ? badge(`${F.money(outstanding)} due`, 'danger') : null,
          waiversOut > 0 ? badge(`${waiversOut} waivers`, 'warn') : null,
          outstanding === 0 && waiversOut === 0 ? badge('Ready', 'ok', true) : null),
        h('div.row', { style: { gap: '4px' } },
          btn('Manifest', { size: 'sm', kind: 'primary', onclick: () => router.go(`/checkin/departure/${av.pk}`) }),
          btn('Bookings', { size: 'sm', onclick: () => openDeparture(d) })),
      ];
    });

    function openDeparture(d) {
      drawer({
        title: `${d.item?.name} — ${F.time12(d.availability.start_time)}`,
        sub: `${F.dateLong(d.availability.date)} · ${d.pax} guests on ${d.bookings.length} bookings`,
        render: () => d.bookings.length ? simpleTable(
          ['Confirmation', 'Guest', { label: 'Pax', align: 'num' }, 'Waivers', { label: 'Balance', align: 'num' }, 'Status', ''],
          d.bookings.map(b => [
            h('a', { href: `#/bookings/detail/${b.pk}`, class: 'mono' }, b.code),
            db.label('contact', b.contact),
            b.pax,
            statusBadge(b.waiver_status),
            b.balance > 0 ? h('span', { style: { color: 'var(--danger)' } }, F.money(b.balance)) : '—',
            b.is_checked_in ? badge('In', 'ok', true) : badge('Waiting', '', true),
            btn('Open', { size: 'sm', onclick: () => openBooking(ctx, b) }),
          ])) : empty('No bookings on this departure'),
      });
    }

    return h('div.page',
      pageHead({
        title: date === F.today() ? 'Today' : F.dateLong(date),
        sub: `${live.length} departures · ${pax} guests · ${db.label('company', domain.company()?.pk)}`,
        actions: [
          h('div.btn-group', btn('‹', { onclick: nav(-1) }), btn('Today', { onclick: () => router.go('/today') }), btn('›', { onclick: nav(1) })),
          h('input.input', { type: 'date', value: date, style: 'width:auto', onchange: (e) => router.go('/today', { date: e.target.value }) }),
          btn('Print all manifests', { icon: '🖨', onclick: () => { window.print(); } }),
        ],
      }),
      moduleIntro(this, 'This is the screen a front-desk lead keeps open all day. It is a projection of the availability table joined to bookings, check-ins and resource assignments.'),

      h('div.grid.c5.mb-4',
        stat({ label: 'Departures', value: F.num(live.length),
          hint: board.length - live.length ? `${board.length - live.length} cancelled` : null }),
        stat({ label: 'Guests expected', value: F.num(pax) }),
        stat({ label: 'Seats filled', value: F.pct(cap ? pax / cap : 0, 0), spark: meter(pax, cap) }),
        stat({ label: 'Value on the water', value: F.money(revenue) }),
        stat({ label: 'To collect at desk', value: F.money(dueAtDesk), tone: dueAtDesk ? 'danger' : null })),

      unassigned.length ? h('div.banner.warn.mb-4',
        h('span', '⚠'),
        h('div', h('div.strong', `${unassigned.length} departure${unassigned.length === 1 ? '' : 's'} have guests but no boat, van or guide assigned`),
          h('div.small', unassigned.map(d => `${F.time12(d.availability.start_time)} ${d.item?.name}`).join(' · '))),
        h('div.spacer'),
        btn('Open resources', { size: 'sm', onclick: () => router.go('/resources', { date }) })) : null,

      rail,

      h('div.mt-4', card({ title: 'Departure board', sub: 'In time order', flush: true },
        live.length
          ? simpleTable(
              ['Time', 'Item', { label: 'Capacity', width: '160px' }, 'Crew & craft', 'Checked in', 'Flags', ''],
              rows)
          : empty('Nothing scheduled', `No departures fall on ${F.dateLong(date)}.`,
              btn('Go to today', { kind: 'primary', onclick: () => router.go('/today') })))));
  },
};
