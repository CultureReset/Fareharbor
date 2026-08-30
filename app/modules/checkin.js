import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, meter, kv, avatar } from '../core/ui/kit.js';
import { toast, drawer, confirm } from '../core/ui/overlay.js';
import { openBooking, moduleIntro, capacityCell } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'checkin',
  title: 'Check-in & Manifests',
  icon: '🧭',
  group: 'Operations',
  order: 60,
  summary: 'The day-of guide view: printable manifests, per-guest check-in, waivers and dietary notes.',
  entities: ['availability', 'booking', 'booking_customer', 'checkin', 'waiver_signature'],

  commands: () => [{ title: 'Open today’s manifests', path: '/checkin' }],

  render(ctx) {
    const { db, domain, router, route } = ctx;
    if (route.sub === 'departure' && route.id) return manifestView(ctx, route.id);

    const date = route.query.date || F.today();
    const board = domain.dayBoard(date).filter(d => d.availability.status !== 'cancelled');

    return h('div.page',
      pageHead({
        title: 'Check-in & Manifests',
        sub: 'Pick a departure to open its manifest. Guides use this screen on a phone at the dock.',
        actions: [
          h('div.btn-group',
            btn('‹', { onclick: () => router.patchQuery({ date: F.addDays(date, -1) }) }),
            btn('Today', { onclick: () => router.patchQuery({ date: F.today() }) }),
            btn('›', { onclick: () => router.patchQuery({ date: F.addDays(date, 1) }) })),
          h('input.input', { type: 'date', value: date, style: 'width:auto', onchange: e => router.patchQuery({ date: e.target.value }) }),
        ],
      }),
      moduleIntro(this, 'A manifest is a join: availability → bookings → booking customers → waivers, custom-field answers and notes flagged “show on manifest”.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Departures', value: F.num(board.length) }),
        stat({ label: 'Guests expected', value: F.num(board.reduce((s, d) => s + d.pax, 0)) }),
        stat({ label: 'Checked in', value: F.num(board.reduce((s, d) => s + d.checkedIn, 0)) }),
        stat({ label: 'Waivers outstanding',
          value: F.num(board.reduce((s, d) => s + d.bookings.filter(b => ['pending', 'partial'].includes(b.waiver_status)).length, 0)),
          tone: 'warn' })),
      board.length ? h('div.grid.c3', ...board.map(d => {
        const pct = d.bookings.length ? d.checkedIn / d.bookings.length : 0;
        const waiversOut = d.bookings.filter(b => ['pending', 'partial'].includes(b.waiver_status)).length;
        const due = d.bookings.reduce((s, b) => s + b.balance, 0);
        return card({},
          h('div.row.mb-3',
            h('div', h('div.strong', F.time12(d.availability.start_time)),
              h('div.small.muted', F.duration(d.item?.duration_minutes))),
            h('div.spacer'),
            pct === 1 ? badge('All aboard', 'ok', true) : badge(`${d.checkedIn}/${d.bookings.length} in`, pct > 0 ? 'warn' : '', true)),
          h('div.strong.mb-2', d.item?.name),
          h('div.small.muted.mb-3', db.label('location', d.item?.location)),
          capacityCell(ctx, d.availability),
          h('div.row.mt-3', { style: { gap: '5px' } },
            waiversOut ? badge(`${waiversOut} waivers`, 'warn') : null,
            due ? badge(`${F.money(due)} due`, 'danger') : null,
            d.resources.length ? badge(d.resources.map(r => r.resource?.name).join(', ')) : badge('No crew', 'danger')),
          h('div.mt-4', btn('Open manifest', { kind: 'primary', block: true,
            onclick: () => router.go(`/checkin/departure/${d.availability.pk}`) })));
      })) : card({}, empty('Nothing scheduled', `No departures on ${F.dateLong(date)}.`)));
  },
};

/* ------------------------------------------------------ manifest view */
function manifestView(ctx, avPk) {
  const { db, domain, router } = ctx;
  const m = domain.manifest(avPk);
  if (!m) return h('div.page', empty('Departure not found'));

  const allIn = m.bookings.length > 0 && m.bookings.every(b => b.booking.is_checked_in);

  const guestRows = m.bookings.flatMap(entry => entry.customers.map((c, i) => {
    const rate = db.get('customer_type_rate', c.customer_type_rate);
    const ct = db.get('customer_type', rate?.customer_type);
    const answers = db.where('custom_field_value', v => v.booking_customer === c.pk)
      .map(v => ({ f: db.get('custom_field', v.custom_field), v: v.value }))
      .filter(x => x.f?.show_on_manifest);
    return [
      h('div.row', { style: { gap: '8px' } },
        h('input', { type: 'checkbox', checked: !!c.checked_in_at,
          onchange: (e) => {
            db.update('booking_customer', c.pk, { checked_in_at: e.target.checked ? new Date().toISOString().slice(0, 19) : null });
            const all = db.children('booking_customer', 'booking', entry.booking.pk).every(x => x.checked_in_at);
            db.update('booking', entry.booking.pk, { is_checked_in: all }, { log: false });
          } }),
        h('div', h('div.strong', c.name || `${ct?.singular || 'Guest'} ${i + 1}`),
          i === 0 && h('div.small.muted', entry.contact?.phone ? F.phone(entry.contact.phone) : entry.contact?.email))),
      ct?.singular || '—',
      i === 0 ? h('a.mono.small', { href: `#/bookings/detail/${entry.booking.pk}` }, entry.booking.code) : '',
      c.waiver_signed ? badge('Signed', 'ok', true) : badge('Missing', 'danger', true),
      i === 0 && entry.lodging ? h('span.small', entry.lodging.name) : '',
      answers.length ? h('div.small', ...answers.map(a => h('div', h('span.muted', a.f.title + ': '), a.v))) : '',
      i === 0 && entry.balance > 0 ? h('span.strong', { style: { color: 'var(--danger)' } }, F.money(entry.balance)) : '',
    ];
  }));

  return h('div.page',
    pageHead({
      breadcrumb: h('a', { href: `#/checkin?date=${m.availability.date}` }, '‹ All departures'),
      title: m.item?.name,
      sub: `${F.dateLong(m.availability.date)} · ${F.time12(m.availability.start_time)}–${F.time12(m.availability.end_time)} · ${db.label('location', m.item?.location)}`,
      actions: [
        btn('Print manifest', { icon: '🖨', onclick: () => window.print() }),
        btn(allIn ? 'Everyone checked in' : 'Check in everyone', {
          kind: 'primary', disabled: allIn,
          onclick: () => confirm({
            title: `Check in all ${m.pax} guests?`,
            body: 'Marks every booking on this departure as arrived. You can undo individual guests afterwards.',
            confirmLabel: 'Check in all',
            onConfirm: () => {
              m.bookings.forEach(b => { if (!b.booking.is_checked_in) domain.checkIn(b.booking, { device: 'dashboard' }); });
              toast(`${m.pax} guests checked in`, { tone: 'ok' });
            },
          }),
        }),
      ],
    }),

    h('div.grid.c5.mb-4',
      stat({ label: 'Guests', value: `${m.pax}`, hint: `${m.bookings.length} bookings` }),
      stat({ label: 'Checked in', value: `${m.checkedIn}/${m.bookings.length}`,
        spark: meter(m.checkedIn, Math.max(1, m.bookings.length)) }),
      stat({ label: 'Seats', value: `${m.availability.booked}/${m.availability.capacity}`,
        spark: meter(m.availability.booked, m.availability.capacity) }),
      stat({ label: 'Waivers outstanding', value: `${m.waiversOutstanding}`, tone: m.waiversOutstanding ? 'warn' : null }),
      stat({ label: 'To collect', value: F.money(m.balanceDue), tone: m.balanceDue ? 'danger' : null })),

    m.availability.notes ? h('div.banner.warn.mb-4', h('span', '📌'),
      h('div', h('div.strong', 'Departure note'), h('div.small', m.availability.notes))) : null,

    h('div.grid.side.mb-4',
      card({ title: 'Guest list', sub: 'Tick each guest as they arrive', flush: true },
        guestRows.length ? simpleTable(
          ['Guest', 'Type', 'Booking', 'Waiver', 'Pickup', 'Notes & answers', { label: 'Balance', align: 'num' }],
          guestRows) : empty('No guests booked')),

      h('div.col',
        card({ title: 'Crew & craft', flush: true },
          m.resources.length ? simpleTable(['Resource', 'Role', 'Status'],
            m.resources.map(r => [h('div', h('div.strong', r.resource?.name), h('div.small.muted', F.titleCase(r.resource?.kind))), r.role, statusBadge(r.status)]))
            : h('div', { style: { padding: '16px' } },
                h('div.banner.danger', h('div', h('div.strong', 'Nothing assigned'),
                  h('div.small', 'No boat, van, gear or guide is committed to this departure.'))),
                h('div.mt-3', btn('Assign resources', { size: 'sm', kind: 'primary', block: true,
                  onclick: () => router.go('/resources', { availability: m.availability.pk, date: m.availability.date }) })))),

        card({ title: 'Notes for the crew' },
          (() => {
            const notes = m.bookings.flatMap(b => b.notes.map(n => ({ ...n, who: b.contact?.name })));
            return notes.length ? h('div.col', ...notes.map(n =>
              h('div', { style: { paddingBottom: '10px', borderBottom: '1px solid var(--border)' } },
                h('div.small.strong', n.who), h('div.small', n.body))))
              : h('div.small.muted', 'No guest-visible or manifest notes on this departure.');
          })()),

        card({ title: 'Pickups', flush: true },
          (() => {
            const pickups = m.bookings.filter(b => b.lodging);
            return pickups.length ? simpleTable(['Lodging', 'Guest', { label: 'Pax', align: 'num' }, 'Pickup'],
              pickups.map(b => [
                b.lodging.name, b.contact?.name, b.booking.pax,
                F.time12(offsetTime(m.availability.start_time, b.lodging.pickup_offset_minutes)),
              ])) : h('div', { style: { padding: '16px' } }, h('div.small.muted', 'Everyone meets on site.'));
          })()))),

    card({ title: 'Bookings on this departure', flush: true },
      simpleTable(
        ['Confirmation', 'Lead guest', { label: 'Pax', align: 'num' }, 'Channel', 'Waivers',
         { label: 'Balance', align: 'num' }, 'Checked in', ''],
        m.bookings.map(b => [
          h('span.mono', b.booking.code),
          h('div', h('div.strong', b.contact?.name), h('div.small.muted', b.contact?.email)),
          b.booking.pax,
          h('span.small', db.label('channel', b.booking.channel)),
          b.waiversOutstanding ? badge(`${b.waiversOutstanding} missing`, 'danger') : badge('Complete', 'ok'),
          b.balance > 0 ? h('span.strong', { style: { color: 'var(--danger)' } }, F.money(b.balance)) : '—',
          b.booking.is_checked_in ? badge('In', 'ok', true) : badge('Waiting', '', true),
          h('div.row', { style: { gap: '4px' } },
            btn('Open', { size: 'sm', onclick: () => openBooking(ctx, b.booking) }),
            !b.booking.is_checked_in ? btn('Check in', { size: 'sm', kind: 'primary',
              onclick: () => { domain.checkIn(b.booking); toast(`${b.contact?.name} checked in`, { tone: 'ok' }); } }) : null),
        ]))));
}

function offsetTime(hhmm, offsetMinutes) {
  const [H, M] = hhmm.split(':').map(Number);
  let total = H * 60 + M + (offsetMinutes || 0);
  total = ((total % 1440) + 1440) % 1440;
  return `${F.pad(Math.floor(total / 60))}:${F.pad(total % 60)}`;
}
