import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { toast, confirm, modal } from '../core/ui/overlay.js';
import { openBooking, bookingColumns, moduleIntro, rangePicker, rangeOf } from './_shared.js';
import * as F from '../core/format.js';

/** Saved views — the filter presets an operator actually lives in. */
const VIEWS = [
  { id: 'all', title: 'All bookings', filter: () => () => true },
  { id: 'upcoming', title: 'Upcoming', filter: (ctx) => (b) => {
      const a = ctx.db.get('availability', b.availability);
      return a && a.date >= F.today() && b.status !== 'cancelled';
    } },
  { id: 'today', title: 'Departing today', filter: (ctx) => (b) => {
      const a = ctx.db.get('availability', b.availability);
      return a && a.date === F.today() && b.status !== 'cancelled';
    } },
  { id: 'balance', title: 'Balance due', filter: () => (b) => b.balance > 0 && b.status !== 'cancelled' },
  { id: 'waivers', title: 'Waivers outstanding', filter: () => (b) =>
      ['pending', 'partial'].includes(b.waiver_status) && b.status === 'confirmed' },
  { id: 'cancelled', title: 'Cancelled', filter: () => (b) => b.status === 'cancelled' },
];

export default {
  id: 'bookings',
  title: 'Bookings',
  icon: '🎟',
  group: 'Operations',
  order: 40,
  summary: 'Search, filter and manage every reservation. The booking detail panel is the deepest screen in the platform.',
  entities: ['booking', 'booking_customer', 'payment', 'note', 'custom_field_value', 'waiver_signature'],

  badge: (ctx) => ctx.db.where('booking', b => b.balance > 0 && b.status !== 'cancelled').length,

  search(q, ctx) {
    const ql = q.toLowerCase();
    return ctx.db.all('booking')
      .filter(b => b.code.toLowerCase().includes(ql)
        || ctx.db.label('contact', b.contact).toLowerCase().includes(ql))
      .slice(0, 6)
      .map(b => ({
        title: `${b.code} — ${ctx.db.label('contact', b.contact)}`,
        sub: `${ctx.db.label('item', b.item)} · ${F.money(b.total)}`,
        path: `/bookings/detail/${b.pk}`, kind: b.status,
      }));
  },

  commands: (ctx) => [
    { title: 'Bookings — balance due', path: '/bookings?view=balance' },
    { title: 'Bookings — departing today', path: '/bookings?view=today' },
  ],

  render(ctx) {
    const { db, route, router } = ctx;

    // deep link: /bookings/detail/<pk> opens the drawer over the list
    if (route.sub === 'detail' && route.id) {
      setTimeout(() => openBooking(ctx, route.id), 0);
    }

    const viewId = route.query.view || 'all';
    const view = VIEWS.find(v => v.id === viewId) || VIEWS[0];
    const rows = db.all('booking').filter(view.filter(ctx));

    const totals = {
      count: rows.length,
      revenue: rows.filter(r => r.status !== 'cancelled').reduce((s, r) => s + r.total, 0),
      due: rows.reduce((s, r) => s + Math.max(0, r.balance), 0),
      pax: rows.filter(r => r.status !== 'cancelled').reduce((s, r) => s + r.pax, 0),
    };

    const table = dataTable({
      rows,
      columns: bookingColumns(ctx),
      searchPlaceholder: 'Confirmation #, guest name or email…',
      exportName: `bookings-${viewId}`,
      defaultSort: 'created_at', defaultDir: 'desc',
      onRowClick: (r) => router.go(`/bookings/detail/${r.pk}`),
      selectable: true,
      filters: [
        { key: 'status', label: 'Any status',
          options: ['confirmed', 'pending', 'completed', 'cancelled', 'no_show'].map(s => [s, F.titleCase(s)]) },
        { key: 'item', label: 'Any item',
          options: db.all('item').map(i => [i.pk, i.name]) },
        { key: 'channel', label: 'Any channel',
          options: db.all('channel').map(c => [c.pk, c.name]) },
        { key: 'waiver_status', label: 'Any waiver state',
          options: ['signed', 'partial', 'pending', 'not_required'].map(s => [s, F.titleCase(s)]) },
        { key: 'balance', label: 'Any balance',
          options: [['due', 'Balance due'], ['paid', 'Paid in full']],
          apply: (r, v) => v === 'due' ? r.balance > 0 : r.balance <= 0 },
      ],
      bulkActions: (selected, clear) => [
        btn('Resend confirmations', { size: 'sm', onclick: () => {
          selected.forEach(pk => {
            const b = db.get('booking', pk);
            db.insert('message_log', {
              template: db.all('message_template')[0]?.pk, booking: pk,
              to: db.get('contact', b.contact)?.email, medium: 'email',
              subject: 'Your booking is confirmed', status: 'delivered',
              sent_at: new Date().toISOString().slice(0, 19),
            }, { log: false });
          });
          toast(`${selected.length} confirmations resent`, { tone: 'ok' }); clear();
        } }),
        btn('Check in', { size: 'sm', onclick: () => {
          selected.forEach(pk => {
            const b = db.get('booking', pk);
            if (b && !b.is_checked_in && b.status !== 'cancelled') ctx.domain.checkIn(b);
          });
          toast(`${selected.length} bookings checked in`, { tone: 'ok' }); clear();
        } }),
        btn('Cancel…', { size: 'sm', kind: 'danger', onclick: () => confirm({
          title: `Cancel ${selected.length} bookings?`,
          body: 'Seats return to their departures. Refunds are not issued automatically in bulk — do those individually.',
          confirmLabel: 'Cancel bookings', tone: 'danger',
          onConfirm: () => {
            selected.forEach(pk => { const b = db.get('booking', pk); if (b) ctx.domain.cancelBooking(b, { reason: 'Bulk cancellation' }); });
            toast(`${selected.length} bookings cancelled`, { tone: 'ok' }); clear();
          },
        }) }),
      ],
    });

    return h('div.page',
      pageHead({
        title: 'Bookings',
        sub: 'Every reservation across every channel. Click any row to open the full record.',
        actions: [btn('New booking', { kind: 'primary', icon: '＋', onclick: () => router.go('/book') })],
      }),
      moduleIntro(this, 'Views below are saved filters. The list itself is the same DataTable used by every other section — sortable, searchable, filterable and exportable.'),

      h('div.grid.c4.mb-4',
        stat({ label: 'Bookings in view', value: F.num(totals.count) }),
        stat({ label: 'Guests', value: F.num(totals.pax) }),
        stat({ label: 'Booked value', value: F.money(totals.revenue) }),
        stat({ label: 'Outstanding balance', value: F.money(totals.due), tone: totals.due > 0 ? 'danger' : null })),

      h('div.row.mb-3',
        ...VIEWS.map(v => btn(v.title, {
          size: 'sm', kind: v.id === viewId ? 'primary' : '',
          onclick: () => router.go('/bookings', v.id === 'all' ? {} : { view: v.id }),
        }))),

      card({ flush: true }, table));
  },
};
