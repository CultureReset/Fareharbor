import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, meter, checkbox } from '../core/ui/kit.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { openBooking, moduleIntro, capacityCell } from './_shared.js';
import * as F from '../core/format.js';

const MODES = [['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['list', 'List']];

export default {
  id: 'calendar',
  title: 'Calendar',
  icon: '🗓',
  group: 'Operations',
  order: 50,
  summary: 'Month, week and day views of the departure schedule, with capacity at a glance and inline editing.',
  entities: ['availability', 'availability_template', 'item', 'booking'],

  commands: () => [
    { title: 'Calendar — this month', path: '/calendar' },
    { title: 'Add departures to the schedule', path: '/calendar?new=1' },
  ],

  render(ctx) {
    const { db, domain, router, route } = ctx;
    const mode = route.query.mode || 'month';
    const anchor = route.query.date || F.today();
    const itemFilter = route.query.item || '';

    if (route.query.new) setTimeout(() => addDepartures(ctx), 0);

    const shift = (n) => {
      const next = mode === 'month' ? F.addMonths(anchor, n)
        : mode === 'week' ? F.addDays(anchor, n * 7) : F.addDays(anchor, n);
      router.patchQuery({ date: next });
    };

    const inScope = (a) => !itemFilter || a.item === itemFilter;

    const header = h('div.row.mb-4',
      h('div.btn-group', ...MODES.map(([id, label]) => {
        const b = btn(label, { size: 'sm', onclick: () => router.patchQuery({ mode: id }) });
        if (id === mode) b.classList.add('is-on');
        return b;
      })),
      h('div.btn-group', btn('‹', { onclick: () => shift(-1) }),
        btn('Today', { onclick: () => router.patchQuery({ date: F.today() }) }),
        btn('›', { onclick: () => shift(1) })),
      h('div', { style: { minWidth: '210px' } },
        select([['', 'All items'], ...db.all('item').map(i => [i.pk, i.name])], itemFilter,
          v => router.patchQuery({ item: v }))),
      h('div.spacer'),
      btn('Add departures', { kind: 'primary', icon: '＋', onclick: () => addDepartures(ctx) }));

    const views = { month: monthView, week: weekView, day: dayView, list: listView };
    const scopeStart = mode === 'month' ? F.startOfMonth(anchor) : mode === 'week' ? F.startOfWeek(anchor) : anchor;
    const scopeEnd = mode === 'month' ? F.addDays(F.addMonths(F.startOfMonth(anchor), 1), -1)
      : mode === 'week' ? F.addDays(F.startOfWeek(anchor), 6) : anchor;
    const scoped = db.where('availability', a => a.date >= scopeStart && a.date <= scopeEnd && inScope(a));
    const cap = scoped.reduce((s, a) => s + a.capacity, 0);
    const bkd = scoped.reduce((s, a) => s + a.booked, 0);

    return h('div.page',
      pageHead({
        title: 'Calendar',
        sub: mode === 'month' ? F.monthLabel(anchor)
          : mode === 'week' ? `Week of ${F.dateShort(F.startOfWeek(anchor))}` : F.dateLong(anchor),
        actions: [h('input.input', { type: 'date', value: anchor, style: 'width:auto',
          onchange: (e) => router.patchQuery({ date: e.target.value }) })],
      }),
      moduleIntro(this, 'An availability is one dated, timed departure with its own capacity. Schedules (recurrence rules) generate them in bulk; you can also add or block individual slots here.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Departures in view', value: F.num(scoped.length) }),
        stat({ label: 'Seats offered', value: F.num(cap) }),
        stat({ label: 'Seats sold', value: F.num(bkd), spark: meter(bkd, cap) }),
        stat({ label: 'Sold out', value: F.num(scoped.filter(a => domain.seatsLeft(a) <= 0 && a.status !== 'cancelled').length) })),
      header,
      views[mode](ctx, anchor, inScope));
  },
};

/* --------------------------------------------------------- month view */
function monthView(ctx, anchor, inScope) {
  const { db, domain, router } = ctx;
  const first = F.parseISO(F.startOfMonth(anchor));
  const gridStart = F.addDays(F.toISO(first), -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => F.addDays(gridStart, i));
  const thisMonth = anchor.slice(0, 7);

  return h('div.cal',
    h('div.cal__dow', ...['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => h('div', d))),
    h('div.cal__grid', ...cells.map(date => {
      const list = db.where('availability', a => a.date === date && inScope(a))
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      const shown = list.slice(0, 4);
      return h('div.cal__cell', {
        class: [date.slice(0, 7) !== thisMonth ? 'other' : '', date === F.today() ? 'today' : ''].filter(Boolean).join(' '),
        onclick: (e) => { if (e.target.closest('.cal__ev')) return; router.patchQuery({ mode: 'day', date }); },
      },
        h('div.row', { style: { gap: '4px' } },
          h('span.cal__num', String(F.parseISO(date).getDate())),
          list.length ? h('span.small.subtle', { style: { marginLeft: 'auto' } },
            `${list.reduce((s, a) => s + a.booked, 0)}/${list.reduce((s, a) => s + a.capacity, 0)}`) : null),
        ...shown.map(a => h('button.cal__ev', {
          class: domain.capacityState(a),
          onclick: () => openDeparture(ctx, a),
          title: `${db.label('item', a.item)} — ${a.booked}/${a.capacity}`,
        }, `${F.time12(a.start_time)} ${F.truncate(db.label('item', a.item), 18)}`)),
        list.length > shown.length ? h('div.cal__more', `+${list.length - shown.length} more`) : null);
    })));
}

/* ---------------------------------------------------------- week view */
function weekView(ctx, anchor, inScope) {
  const { db, domain, router } = ctx;
  const start = F.startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => F.addDays(start, i));
  return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: '8px' } },
    ...days.map(date => {
      const list = db.where('availability', a => a.date === date && inScope(a))
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      return card({},
        h('div.row.mb-3',
          h('div', h('div.strong', F.dowName(F.parseISO(date).getDay())),
            h('div.small.muted', F.dateShort(date))),
          date === F.today() ? badge('Today', 'info') : null),
        list.length ? h('div.col', { style: { gap: '5px' } }, ...list.map(a =>
          h('button.cal__ev', {
            class: domain.capacityState(a),
            style: { padding: '5px 7px', whiteSpace: 'normal', textAlign: 'left' },
            onclick: () => openDeparture(ctx, a),
          }, h('div', F.time12(a.start_time)),
             h('div', { style: { fontWeight: 400 } }, F.truncate(db.label('item', a.item), 22)),
             h('div', { style: { fontWeight: 400, opacity: .8 } }, `${a.booked}/${a.capacity}`))))
          : h('div.small.subtle', 'No departures'));
    }));
}

/* ----------------------------------------------------------- day view */
function dayView(ctx, anchor, inScope) {
  const { db, domain, router } = ctx;
  const board = domain.dayBoard(anchor).filter(d => inScope(d.availability));
  if (!board.length) return card({}, empty('Nothing scheduled', F.dateLong(anchor)));
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  return card({ flush: true },
    h('div.sched', ...hours.flatMap(hr => {
      const at = board.filter(d => Number(d.availability.start_time.slice(0, 2)) === hr);
      return [
        h('div.sched__hour', F.time12(F.pad(hr) + ':00')),
        h('div.sched__lane', ...at.map(d => h('button.cal__ev', {
          class: domain.capacityState(d.availability),
          style: { width: 'auto', padding: '6px 9px', whiteSpace: 'normal', maxWidth: '260px' },
          onclick: () => openDeparture(ctx, d.availability),
        },
          h('div.strong', `${F.time12(d.availability.start_time)} · ${d.item?.name}`),
          h('div', { style: { fontWeight: 400 } },
            `${d.availability.booked}/${d.availability.capacity} seats · ${d.bookings.length} bookings`),
          d.resources.length ? h('div', { style: { fontWeight: 400, opacity: .8 } },
            d.resources.map(r => r.resource?.name).join(', ')) : null))),
      ];
    })));
}

/* ---------------------------------------------------------- list view */
function listView(ctx, anchor, inScope) {
  const { db, domain, router } = ctx;
  const from = F.startOfMonth(anchor), to = F.addDays(F.addMonths(from, 1), -1);
  const list = db.where('availability', a => a.date >= from && a.date <= to && inScope(a))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  return card({ title: `${list.length} departures in ${F.monthLabel(anchor)}`, flush: true },
    list.length ? simpleTable(
      ['Date', 'Time', 'Item', { label: 'Capacity', width: '150px' }, 'Status', 'Online', ''],
      list.map(a => [
        F.dateMed(a.date), F.time12(a.start_time), db.label('item', a.item),
        capacityCell(ctx, a), statusBadge(a.status), statusBadge(a.online_status),
        btn('Open', { size: 'sm', onclick: () => openDeparture(ctx, a) }),
      ])) : empty('No departures this month'));
}

/* --------------------------------------------------- departure drawer */
export function openDeparture(ctx, av) {
  const { db, domain, router } = ctx;
  drawer({
    width: 'wide',
    title: `${db.label('item', av.item)} — ${F.time12(av.start_time)}`,
    sub: F.dateLong(av.date),
    badge: statusBadge(av.status),
    render: (api) => {
      const fresh = db.get('availability', av.pk);
      const bookings = db.children('booking', 'availability', av.pk);
      const active = bookings.filter(b => b.status !== 'cancelled');
      const assignments = db.children('resource_assignment', 'availability', av.pk);
      return h('div.col', { style: { gap: 'var(--sp-4)' } },
        h('div.grid.c3',
          h('div.stat', h('div.stat__label', 'Seats'),
            h('div.stat__value', `${fresh.booked}/${fresh.capacity}`),
            h('div.mt-2', meter(fresh.booked, fresh.capacity))),
          h('div.stat', h('div.stat__label', 'Bookings'), h('div.stat__value', String(active.length))),
          h('div.stat', h('div.stat__label', 'Value'),
            h('div.stat__value', F.money(active.reduce((s, b) => s + b.total, 0))))),

        card({ title: 'Departure settings' },
          h('div.grid.c2',
            h('div.field', h('label', 'Capacity'),
              h('input.input', { type: 'number', value: fresh.capacity, min: fresh.booked,
                onchange: (e) => { db.update('availability', av.pk, { capacity: Number(e.target.value) }); api.refresh(); } })),
            h('div.field', h('label', 'Status'),
              select(['open', 'sold_out', 'cancelled', 'hidden'], fresh.status,
                v => { db.update('availability', av.pk, { status: v }); api.refresh(); })),
            h('div.field', h('label', 'Online booking'),
              select([['bookable', 'Bookable online'], ['call_only', 'Call to book'], ['closed', 'Closed online']],
                fresh.online_status, v => { db.update('availability', av.pk, { online_status: v }); api.refresh(); })),
            h('div.field', h('label', 'Headline override'),
              h('input.input', { value: fresh.headline || '', placeholder: db.get('item', av.item)?.headline,
                onchange: (e) => db.update('availability', av.pk, { headline: e.target.value }) })),
            h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Internal notes (shown on the manifest)'),
              h('textarea.textarea', { value: fresh.notes || '',
                onchange: (e) => db.update('availability', av.pk, { notes: e.target.value }) })))),

        card({ title: 'Assigned resources', flush: true,
          actions: [btn('Manage', { size: 'sm', onclick: () => { api.close(); router.go('/resources', { availability: av.pk, date: av.date }); } })] },
          assignments.length ? simpleTable(['Resource', 'Type', 'Role', 'Status'],
            assignments.map(a2 => {
              const r = db.get('resource', a2.resource);
              return [r?.name, F.titleCase(r?.kind), a2.role, statusBadge(a2.status)];
            }))
            : empty('Nothing assigned', 'No boat, van, gear or guide is committed to this departure.')),

        card({ title: `Bookings (${bookings.length})`, flush: true },
          bookings.length ? simpleTable(
            ['Confirmation', 'Guest', { label: 'Pax', align: 'num' }, 'Status', { label: 'Total', align: 'num' }, ''],
            bookings.map(b => [
              h('span.mono', b.code), db.label('contact', b.contact), b.pax,
              statusBadge(b.status), F.money(b.total),
              btn('Open', { size: 'sm', onclick: () => openBooking(ctx, b) }),
            ])) : empty('No bookings yet')));
    },
    foot: (api) => [
      btn('Cancel departure', { kind: 'danger', onclick: () => confirm({
        title: 'Cancel this departure?',
        body: 'Existing bookings stay on the record but the slot disappears from the online calendar. Refunds are handled per booking.',
        confirmLabel: 'Cancel departure', tone: 'danger',
        onConfirm: () => { db.update('availability', av.pk, { status: 'cancelled' }); api.refresh(); toast('Departure cancelled', { tone: 'ok' }); },
      }) }),
      btn('Book onto this departure', { kind: 'primary', onclick: () => { api.close(); ctx.router.go(`/book/slot/${av.pk}`); } }),
    ],
  });
}

/* -------------------------------------------------- bulk slot creator */
function addDepartures(ctx) {
  const { db, domain } = ctx;
  const items = db.where('item', i => i.status !== 'archived');
  const draft = {
    item: items[0]?.pk, start: F.today(), end: F.addDays(F.today(), 30),
    days: [0, 1, 2, 3, 4, 5, 6], times: '09:00, 13:00', capacity: items[0]?.capacity_default || 12,
    saveTemplate: true,
  };
  let preview = 0;
  const recount = () => {
    const times = draft.times.split(',').map(t => t.trim()).filter(Boolean);
    let n = 0;
    for (let d = draft.start; d <= draft.end; d = F.addDays(d, 1))
      if (draft.days.includes(F.parseISO(d).getDay())) n += times.length;
    preview = n;
  };
  recount();

  modal({
    title: 'Add departures',
    sub: 'This is the recurrence rule behind FareHarbor’s schedules — pick the item, the window, the days and the times.',
    width: 'wide',
    render: (api) => h('div.col',
      h('div.grid.c2',
        h('div.field', h('label', 'Item'),
          select(items.map(i => [i.pk, i.name]), draft.item, v => {
            draft.item = v; draft.capacity = db.get('item', v)?.capacity_default || 12; api.refresh();
          })),
        h('div.field', h('label', 'Capacity per departure'),
          h('input.input', { type: 'number', value: draft.capacity, onchange: (e) => { draft.capacity = Number(e.target.value); } })),
        h('div.field', h('label', 'From'),
          h('input.input', { type: 'date', value: draft.start, onchange: (e) => { draft.start = e.target.value; recount(); api.refresh(); } })),
        h('div.field', h('label', 'Until'),
          h('input.input', { type: 'date', value: draft.end, onchange: (e) => { draft.end = e.target.value; recount(); api.refresh(); } }))),
      h('div.field.mt-3', h('label', 'Days of the week'),
        h('div.row', ...[0, 1, 2, 3, 4, 5, 6].map(d => {
          const b = btn(F.dowName(d), { size: 'sm', onclick: () => {
            draft.days = draft.days.includes(d) ? draft.days.filter(x => x !== d) : [...draft.days, d];
            recount(); api.refresh();
          } });
          if (draft.days.includes(d)) { b.classList.add('primary'); }
          return b;
        }))),
      h('div.field.mt-3', h('label', 'Departure times (comma separated, 24h)'),
        h('input.input', { value: draft.times, onchange: (e) => { draft.times = e.target.value; recount(); api.refresh(); } })),
      h('div.mt-3', checkbox('Also save this as a reusable schedule', draft.saveTemplate, v => { draft.saveTemplate = v; })),
      h('div.banner.info.mt-4', h('div',
        h('div.strong', `${preview} departures will be created`),
        h('div.small', `${preview * draft.capacity} seats added to the calendar between ${F.dateShort(draft.start)} and ${F.dateShort(draft.end)}.`)))),
    foot: (api) => [
      btn('Cancel', { onclick: api.close }),
      btn(`Create ${preview} departures`, { kind: 'primary', disabled: preview === 0, onclick: () => {
        const times = draft.times.split(',').map(t => t.trim()).filter(Boolean);
        const item = db.get('item', draft.item);
        let tpl = null;
        if (draft.saveTemplate) {
          tpl = db.insert('availability_template', {
            item: item.pk, name: `${item.name} — added ${F.dateShort(F.today())}`,
            start_date: draft.start, end_date: draft.end, days_of_week: draft.days,
            times, capacity: draft.capacity, is_active: true,
          });
        }
        let made = 0;
        for (let d = draft.start; d <= draft.end; d = F.addDays(d, 1)) {
          if (!draft.days.includes(F.parseISO(d).getDay())) continue;
          for (const t of times) {
            const [H, M] = t.split(':').map(Number);
            const endM = H * 60 + M + (item.duration_minutes || 60);
            db.insert('availability', {
              item: item.pk, date: d, start_time: t,
              end_time: `${F.pad(Math.floor(endM / 60) % 24)}:${F.pad(endM % 60)}`,
              capacity: draft.capacity, booked: 0, headline: null, status: 'open',
              online_status: 'bookable', template: tpl?.pk || null, notes: '',
            }, { log: false });
            made++;
          }
        }
        api.close();
        toast(`${made} departures added`, { detail: item.name, tone: 'ok' });
      } }),
    ],
  });
}
