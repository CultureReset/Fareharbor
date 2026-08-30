import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, avatar, chip, toggle, timeline } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { rankBars, donut, legend } from '../core/ui/chart.js';
import { openBooking, moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'contacts',
  title: 'Contacts',
  icon: '👤',
  group: 'Guests',
  order: 120,
  summary: 'The guest CRM: lifetime value, booking history, marketing consent and duplicate merging.',
  entities: ['contact', 'booking', 'membership'],

  search(q, ctx) {
    const ql = q.toLowerCase();
    return ctx.db.all('contact')
      .filter(c => c.name.toLowerCase().includes(ql) || (c.email || '').toLowerCase().includes(ql))
      .slice(0, 6)
      .map(c => ({ title: c.name, sub: `${c.email} · ${c.booking_count} bookings · ${F.money(c.lifetime_value)}`,
        path: `/contacts/detail/${c.pk}`, kind: 'guest' }));
  },

  render(ctx) {
    const { db, router, route } = ctx;
    if (route.sub === 'detail' && route.id) return contactDetail(ctx, route.id);

    const contacts = db.all('contact');
    const withBookings = contacts.filter(c => c.booking_count > 0);
    const repeat = contacts.filter(c => c.booking_count > 1);
    const optedIn = contacts.filter(c => c.marketing_opt_in);

    const byCountry = db.groupBy(contacts, c => c.country, {})
      .map(g => ({ label: g.key, value: g.count })).sort((a, b) => b.value - a.value);

    const table = dataTable({
      rows: contacts,
      exportName: 'contacts',
      defaultSort: 'lifetime_value', defaultDir: 'desc',
      searchPlaceholder: 'Name, email or phone…',
      onRowClick: (c) => router.go(`/contacts/detail/${c.pk}`),
      selectable: true,
      columns: [
        { key: 'name', label: 'Guest', render: c => h('div.row', { style: { gap: '9px' } },
          avatar(c.name, true), h('div', h('div.strong', c.name), h('div.small.muted', c.email))) },
        { key: 'phone', label: 'Phone', fmt: F.phone },
        { key: 'city', label: 'From', value: c => `${c.city}, ${c.country}` },
        { key: 'booking_count', label: 'Bookings', align: 'num' },
        { key: 'lifetime_value', label: 'Lifetime value', align: 'num', fmt: F.money },
        { key: 'last_booked', label: 'Last booked', render: c => c.last_booked
          ? h('div', h('div', F.dateShort(c.last_booked)), h('div.small.muted', F.relative(c.last_booked + 'T12:00:00'))) : '—' },
        { key: 'marketing_opt_in', label: 'Marketing', render: c => c.marketing_opt_in ? badge('Opted in', 'ok', true) : badge('No', '', true) },
        { key: 'tags', label: 'Tags', sortable: false, render: c => h('div.row', { style: { gap: '3px' } }, ...(c.tags || []).map(t => badge(t))) },
      ],
      filters: [
        { key: 'marketing_opt_in', label: 'Any consent', options: [['yes', 'Opted in'], ['no', 'Not opted in']],
          apply: (r, v) => v === 'yes' ? r.marketing_opt_in : !r.marketing_opt_in },
        { key: 'repeat', label: 'Any frequency', options: [['repeat', 'Repeat guests'], ['once', 'One booking'], ['none', 'Never booked']],
          apply: (r, v) => v === 'repeat' ? r.booking_count > 1 : v === 'once' ? r.booking_count === 1 : r.booking_count === 0 },
        { key: 'country', label: 'Any country', options: [...new Set(contacts.map(c => c.country))].sort().map(c => [c, c]) },
      ],
      bulkActions: (sel, clear) => [
        btn('Export selection', { size: 'sm', onclick: () => { toast(`${sel.length} contacts queued for export`, { tone: 'ok' }); clear(); } }),
        btn('Add tag…', { size: 'sm', onclick: () => {
          let tag = 'vip';
          modal({ title: 'Tag contacts', render: () => h('div.field', h('label', 'Tag'),
              h('input.input', { value: tag, oninput: e => { tag = e.target.value; } })),
            foot: (api) => [btn('Cancel', { onclick: api.close }), btn('Apply', { kind: 'primary', onclick: () => {
              sel.forEach(pk => { const c = db.get('contact', pk); db.update('contact', pk, { tags: [...new Set([...(c.tags || []), tag])] }, { log: false }); });
              api.close(); clear(); toast(`Tagged ${sel.length} contacts`, { tone: 'ok' });
            } })] });
        } }),
      ],
    });

    return h('div.page',
      pageHead({
        title: 'Contacts',
        sub: 'One record per guest, deduplicated by email so history survives rebooking.',
        actions: [btn('New contact', { kind: 'primary', icon: '＋', onclick: () => newContact(ctx) })],
      }),
      moduleIntro(this),
      h('div.grid.c5.mb-4',
        stat({ label: 'Contacts', value: F.num(contacts.length) }),
        stat({ label: 'Have booked', value: F.num(withBookings.length) }),
        stat({ label: 'Repeat guests', value: F.num(repeat.length),
          hint: `${F.pct(withBookings.length ? repeat.length / withBookings.length : 0, 0)} of bookers` }),
        stat({ label: 'Marketing consent', value: F.pct(contacts.length ? optedIn.length / contacts.length : 0, 0) }),
        stat({ label: 'Total lifetime value', value: F.money(contacts.reduce((s, c) => s + c.lifetime_value, 0)) })),
      h('div.grid.side',
        card({ flush: true }, table),
        h('div.col',
          card({ title: 'Where guests come from' }, rankBars(byCountry, { money: false, limit: 8 })),
          card({ title: 'Top guests by lifetime value', flush: true },
            simpleTable(['Guest', { label: 'Bookings', align: 'num' }, { label: 'Value', align: 'num' }],
              [...contacts].sort((a, b) => b.lifetime_value - a.lifetime_value).slice(0, 8).map(c => [
                h('a', { href: `#/contacts/detail/${c.pk}` }, c.name), c.booking_count, F.money(c.lifetime_value),
              ]))))));
  },
};

function contactDetail(ctx, pk) {
  const { db, router } = ctx;
  const c = db.get('contact', pk);
  if (!c) return h('div.page', empty('Contact not found'));
  const bookings = db.children('booking', 'contact', c.pk)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const memberships = db.children('membership', 'contact', c.pk);
  const active = bookings.filter(b => b.status !== 'cancelled');
  const upcoming = active.filter(b => { const a = db.get('availability', b.availability); return a && a.date >= F.today(); });
  const items = db.groupBy(active, b => db.label('item', b.item), { total: rs => rs.reduce((s, x) => s + x.total, 0) })
    .map(g => ({ label: g.key, value: g.total })).sort((a, b) => b.value - a.value);

  const set = (patch) => db.update('contact', c.pk, patch);

  return h('div.page',
    pageHead({
      breadcrumb: h('a', { href: '#/contacts' }, '‹ All contacts'),
      title: c.name,
      sub: `${c.email} · ${F.phone(c.phone)} · ${[c.city, c.country].filter(Boolean).join(', ')}`,
      actions: [
        btn('Find duplicates', { onclick: () => findDuplicates(ctx, c) }),
        btn('Book for this guest', { kind: 'primary', onclick: () => router.go('/book', { contact: c.pk }) }),
      ],
    }),
    h('div.grid.c4.mb-4',
      stat({ label: 'Lifetime value', value: F.money(c.lifetime_value) }),
      stat({ label: 'Bookings', value: F.num(c.booking_count), hint: `${bookings.filter(b => b.status === 'cancelled').length} cancelled` }),
      stat({ label: 'Upcoming', value: F.num(upcoming.length) }),
      stat({ label: 'Guest since', value: c.first_booked ? F.dateShort(c.first_booked) : '—' })),
    h('div.grid.side',
      h('div.col',
        card({ title: `Booking history (${bookings.length})`, flush: true },
          bookings.length ? simpleTable(
            ['Confirmation', 'Item', 'Departure', { label: 'Pax', align: 'num' }, 'Status', { label: 'Total', align: 'num' }, ''],
            bookings.slice(0, 40).map(b => {
              const a = db.get('availability', b.availability);
              return [
                h('span.mono', b.code), db.label('item', b.item),
                a ? `${F.dateShort(a.date)} ${F.time12(a.start_time)}` : '—',
                b.pax, statusBadge(b.status), F.money(b.total),
                btn('Open', { size: 'sm', onclick: () => openBooking(ctx, b) }),
              ];
            })) : empty('No bookings yet')),
        memberships.length ? card({ title: 'Memberships', flush: true },
          simpleTable(['Plan', 'Started', 'Renews', { label: 'Visits used', align: 'num' }, 'Status'],
            memberships.map(m => [db.label('membership_type', m.membership_type), F.dateShort(m.started_on),
              F.dateShort(m.renews_on), m.visits_used, statusBadge(m.status)]))) : null),
      h('div.col',
        card({ title: 'Contact details' }, h('div.col',
          h('div.field', h('label', 'Name'), h('input.input', { value: c.name, onchange: e => set({ name: e.target.value }) })),
          h('div.field', h('label', 'Email'), h('input.input', { value: c.email || '', onchange: e => set({ email: e.target.value }) })),
          h('div.field', h('label', 'Phone'), h('input.input', { value: c.phone || '', onchange: e => set({ phone: e.target.value }) })),
          h('div.field', h('label', 'City'), h('input.input', { value: c.city || '', onchange: e => set({ city: e.target.value }) })),
          h('div.row.mt-2', h('div', { style: { flex: 1 } },
            h('div.small.strong', 'Marketing consent'),
            h('div.small.muted', 'Controls whether this guest receives campaigns.')),
            toggle(c.marketing_opt_in, v => set({ marketing_opt_in: v }))))),
        card({ title: 'Tags' },
          h('div.row', ...(c.tags || []).map(t => chip(t, () => set({ tags: c.tags.filter(x => x !== t) }))),
            btn('＋', { size: 'sm', onclick: () => {
              let tag = '';
              modal({ title: 'Add tag', render: () => h('div.field', h('label', 'Tag'),
                h('input.input', { oninput: e => { tag = e.target.value; } })),
                foot: (api) => [btn('Cancel', { onclick: api.close }),
                  btn('Add', { kind: 'primary', onclick: () => { if (tag) set({ tags: [...(c.tags || []), tag] }); api.close(); } })] });
            } }))),
        card({ title: 'Internal notes' },
          h('textarea.textarea', { value: c.notes || '', placeholder: 'Anything the team should know…',
            onchange: e => set({ notes: e.target.value }) })),
        items.length ? card({ title: 'What they book' }, rankBars(items, { limit: 5 })) : null)));
}

function findDuplicates(ctx, c) {
  const { db } = ctx;
  const last = c.name.split(' ').slice(-1)[0].toLowerCase();
  const candidates = db.all('contact').filter(x => x.pk !== c.pk &&
    (x.name.toLowerCase().includes(last) || (x.phone && x.phone === c.phone)));
  modal({
    title: 'Possible duplicates',
    sub: 'Merging moves every booking onto the surviving record and sums lifetime value.',
    render: () => candidates.length ? simpleTable(
      ['Guest', 'Email', { label: 'Bookings', align: 'num' }, { label: 'Value', align: 'num' }, ''],
      candidates.slice(0, 10).map(x => [
        x.name, h('span.small', x.email), x.booking_count, F.money(x.lifetime_value),
        btn('Merge into ' + c.name.split(' ')[0], { size: 'sm', kind: 'primary', onclick: () => {
          db.children('booking', 'contact', x.pk).forEach(b => db.update('booking', b.pk, { contact: c.pk }, { log: false }));
          db.update('contact', c.pk, {
            booking_count: c.booking_count + x.booking_count,
            lifetime_value: c.lifetime_value + x.lifetime_value,
          });
          db.remove('contact', x.pk);
          toast(`Merged ${x.name} into ${c.name}`, { tone: 'ok' });
        } }),
      ])) : empty('No likely duplicates', 'Nothing shares this surname or phone number.'),
  });
}

function newContact(ctx) {
  const { db, router } = ctx;
  const draft = { name: '', email: '', phone: '', city: '', country: 'US', marketing_opt_in: false };
  modal({
    title: 'New contact',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Name'),
        h('input.input', { oninput: e => { draft.name = e.target.value; } })),
      h('div.field', h('label', 'Email'), h('input.input', { type: 'email', oninput: e => { draft.email = e.target.value; } })),
      h('div.field', h('label', 'Phone'), h('input.input', { oninput: e => { draft.phone = e.target.value; } })),
      h('div.field', h('label', 'City'), h('input.input', { oninput: e => { draft.city = e.target.value; } })),
      h('div.field', h('label', 'Country'), h('input.input', { value: draft.country, oninput: e => { draft.country = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Create contact', { kind: 'primary', onclick: () => {
        if (!draft.name.trim()) return toast('Name is required', { tone: 'warn' });
        const c = db.insert('contact', { company: ctx.domain.company().pk, ...draft,
          booking_count: 0, lifetime_value: 0, first_booked: null, last_booked: null, tags: [], notes: '' });
        api.close(); router.go(`/contacts/detail/${c.pk}`);
      } })],
  });
}
