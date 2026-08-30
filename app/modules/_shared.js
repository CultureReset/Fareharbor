/**
 * _shared.js — cross-section pieces.
 *
 * The booking detail panel is opened from Bookings, Today, Calendar, Check-in,
 * Contacts and Reports, so it lives here rather than in any one of them.
 */
import { h, frag } from '../core/dom.js';
import { btn, badge, statusBadge, kv, card, tabs, empty, meter, avatar, timeline, banner, chip, checkbox, input, select, simpleTable } from '../core/ui/kit.js';
import { drawer, modal, confirm, toast, menu } from '../core/ui/overlay.js';
import { dataTable } from '../core/ui/table.js';
import * as F from '../core/format.js';

/* ---------------------------------------------------------- date range */
export const RANGES = [
  ['today', 'Today', () => [F.today(), F.today()]],
  ['7d', 'Last 7 days', () => [F.addDays(F.today(), -6), F.today()]],
  ['30d', 'Last 30 days', () => [F.addDays(F.today(), -29), F.today()]],
  ['90d', 'Last 90 days', () => [F.addDays(F.today(), -89), F.today()]],
  ['mtd', 'Month to date', () => [F.startOfMonth(F.today()), F.today()]],
  ['next30', 'Next 30 days', () => [F.today(), F.addDays(F.today(), 30)]],
  ['ytd', 'Year to date', () => [F.today().slice(0, 4) + '-01-01', F.today()]],
];

/** A range picker bound to the URL, so any view is linkable. */
export function rangePicker(ctx, { key = 'range', defaultKey = '30d', onChange } = {}) {
  const current = ctx.route.query[key] || defaultKey;
  return h('div.btn-group',
    ...RANGES.map(([id, label]) => btn(label, {
      size: 'sm', kind: '',
      onclick: () => { ctx.router.patchQuery({ [key]: id }); onChange?.(rangeOf(ctx, key, defaultKey)); },
    })).map((b, i) => { if (RANGES[i][0] === current) b.classList.add('is-on'); return b; }));
}
export function rangeOf(ctx, key = 'range', defaultKey = '30d') {
  const id = ctx.route.query[key] || defaultKey;
  const def = RANGES.find(r => r[0] === id) || RANGES.find(r => r[0] === defaultKey);
  const [from, to] = def[2]();
  return { id, label: def[1], from, to };
}

/* -------------------------------------------------- capacity display */
export function capacityCell(ctx, av) {
  const state = ctx.domain.capacityState(av);
  const left = ctx.domain.seatsLeft(av);
  return h('div', { style: { minWidth: '110px' } },
    h('div.row', { style: { gap: '6px', justifyContent: 'space-between' } },
      h('span.small.mono', `${av.booked}/${av.capacity}`),
      h('span.small', { style: { color: `var(--${state === 'full' ? 'danger' : state === 'tight' ? 'warn' : 'ok'})` } },
        state === 'full' ? 'Full' : `${left} left`)),
    meter(av.booked, av.capacity));
}

/* ------------------------------------------------------ booking drawer */
export function openBooking(ctx, bookingOrPk) {
  const { db, domain, router } = ctx;
  const pk = typeof bookingOrPk === 'string' ? bookingOrPk : bookingOrPk.pk;
  let tab = 'overview';

  const api = drawer({
    width: 'wide',
    title: db.get('booking', pk)?.code || 'Booking',
    sub: (() => {
      const b = db.get('booking', pk); if (!b) return '';
      const av = db.get('availability', b.availability);
      return `${db.label('item', b.item)} · ${av ? F.dateLong(av.date) + ' at ' + F.time12(av.start_time) : '—'}`;
    })(),
    badge: statusBadge(db.get('booking', pk)?.status),
    render: (api) => renderBooking(ctx, pk, tab, (t) => { tab = t; api.refresh(); }, api),
    foot: (api) => {
      const b = db.get('booking', pk);
      if (!b) return null;
      return [
        btn('More', {
          icon: '⋯', onclick: (e) => menu(e.currentTarget, [
            { label: 'Resend confirmation', icon: '✉', onClick: () => {
              db.insert('message_log', {
                template: db.all('message_template')[0]?.pk, booking: b.pk,
                to: db.get('contact', b.contact)?.email, medium: 'email',
                subject: 'Your booking is confirmed', status: 'delivered',
                sent_at: new Date().toISOString().slice(0, 19),
              });
              toast('Confirmation resent', { tone: 'ok' });
            } },
            { label: 'Open manifest', icon: '🧭', onClick: () => { api.close(); router.go(`/checkin/departure/${b.availability}`); } },
            { label: 'View guest record', icon: '👤', onClick: () => { api.close(); router.go(`/contacts/detail/${b.contact}`); } },
            'divider',
            { label: 'Move to another departure', icon: '⇄', onClick: () => moveBooking(ctx, b, api) },
            { label: 'Cancel booking', icon: '✕', tone: 'danger', onClick: () => cancelFlow(ctx, b, api) },
          ]),
        }),
        b.balance > 0 && btn(`Take ${F.money(b.balance)}`, { kind: 'primary', onclick: () => takePaymentFlow(ctx, b, api) }),
        !b.is_checked_in && b.status !== 'cancelled' && btn('Check in', {
          kind: b.balance > 0 ? '' : 'primary',
          onclick: () => { domain.checkIn(b); toast(`${b.code} checked in`, { tone: 'ok' }); api.refresh(); },
        }),
      ].filter(Boolean);
    },
  });
  return api;
}

function renderBooking(ctx, pk, tab, setTab, api) {
  const { db, domain } = ctx;
  const b = db.get('booking', pk);
  if (!b) return empty('This booking no longer exists');
  const item = db.get('item', b.item);
  const av = db.get('availability', b.availability);
  const contact = db.get('contact', b.contact);
  const customers = db.children('booking_customer', 'booking', b.pk);
  const pays = db.children('payment', 'booking', b.pk);
  const notes = db.where('note', n => n.target === b.pk);
  const answers = db.where('custom_field_value', v => v.booking === b.pk);
  const sigs = db.where('waiver_signature', s => s.booking === b.pk);
  const msgs = db.where('message_log', m => m.booking === b.pk);

  const TABS = [
    { id: 'overview', title: 'Overview' },
    { id: 'guests', title: 'Guests', count: customers.length },
    { id: 'payments', title: 'Payments', count: pays.length },
    { id: 'answers', title: 'Answers', count: answers.length },
    { id: 'waivers', title: 'Waivers', count: sigs.length },
    { id: 'messages', title: 'Messages', count: msgs.length },
    { id: 'notes', title: 'Notes', count: notes.length },
    { id: 'history', title: 'History' },
  ];

  const body = {
    overview: () => h('div.grid.c2', { style: { alignItems: 'start' } },
      card({ title: 'Reservation' }, kv([
        ['Confirmation', h('span.mono.strong', b.code)],
        ['Status', statusBadge(b.status)],
        ['Item', h('a', { href: `#/items/detail/${item?.pk}` }, item?.name)],
        ['Departure', av ? `${F.dateLong(av.date)} · ${F.time12(av.start_time)}–${F.time12(av.end_time)}` : '—'],
        ['Guests', `${b.pax} ${b.pax === 1 ? 'guest' : 'guests'}`],
        ['Meeting point', db.label('location', item?.location)],
        ['Pickup', b.lodging ? db.label('lodging', b.lodging) : 'Meets on site'],
        ['Booked', `${F.relative(b.created_at)} · ${F.dateShort(b.created_at.slice(0, 10))}`],
        ['Channel', db.label('channel', b.channel)],
        b.affiliate && ['Affiliate', db.label('affiliate', b.affiliate)],
        b.created_by && ['Taken by', db.label('user', b.created_by)],
        ['Check-in', b.is_checked_in ? badge('Checked in', 'ok', true) : badge('Not checked in', '', true)],
      ])),
      h('div.col',
        card({ title: 'Money' },
          h('dl.kv',
            h('dt', 'Subtotal'), h('dd.right', F.money(b.subtotal)),
            b.discount_total > 0 && frag(h('dt', 'Discount'), h('dd.right', { style: { color: 'var(--ok)' } }, '−' + F.money(b.discount_total))),
            h('dt', 'Taxes & fees'), h('dd.right', F.money(b.tax_total)),
            h('dt', { style: { fontWeight: 700, color: 'var(--fg)' } }, 'Total'),
            h('dd.right.strong', F.money(b.total)),
            h('dt', 'Paid'), h('dd.right', F.money(b.paid)),
            h('dt', { style: { color: b.balance > 0 ? 'var(--danger)' : 'var(--fg-muted)' } }, 'Balance'),
            h('dd.right.strong', { style: { color: b.balance > 0 ? 'var(--danger)' : null } }, F.money(b.balance)))),
        card({ title: 'Guest' },
          h('div.row.mb-3', avatar(contact?.name), h('div',
            h('div.strong', contact?.name),
            h('div.small.muted', contact?.email))),
          kv([
            ['Phone', F.phone(contact?.phone)],
            ['From', [contact?.city, contact?.country].filter(Boolean).join(', ')],
            ['Lifetime', `${contact?.booking_count} bookings · ${F.money(contact?.lifetime_value)}`],
            ['Marketing', contact?.marketing_opt_in ? badge('Opted in', 'ok') : badge('No consent', '')],
          ]),
          h('div.mt-3', btn('Open guest record', {
            size: 'sm', onclick: () => { api.close(); ctx.router.go(`/contacts/detail/${contact.pk}`); },
          }))))),

    guests: () => card({ title: 'Guests on this booking', flush: true },
      simpleTable(
        ['Name', 'Type', { label: 'Price', align: 'num' }, 'Waiver', 'Checked in', ''],
        customers.map(c => {
          const rate = db.get('customer_type_rate', c.customer_type_rate);
          const ct = db.get('customer_type', rate?.customer_type);
          const markSigned = () => {
            db.update('booking_customer', c.pk, { waiver_signed: true });
            const all = db.children('booking_customer', 'booking', b.pk).every(x => x.waiver_signed);
            db.update('booking', b.pk, { waiver_status: all ? 'signed' : 'partial' }, { log: false });
            api.refresh();
          };
          return [
            h('input.input', {
              value: c.name || '', placeholder: 'Name not collected',
              style: 'padding:3px 6px;font-size:var(--fs-sm)',
              onchange: (e) => db.update('booking_customer', c.pk, { name: e.target.value }),
            }),
            ct?.singular || '\u2014',
            F.money(c.price),
            c.waiver_signed ? badge('Signed', 'ok', true) : badge('Pending', 'warn', true),
            c.checked_in_at ? F.time12(c.checked_in_at.slice(11, 16)) : '\u2014',
            c.waiver_signed ? '' : btn('Mark signed', { size: 'sm', onclick: markSigned }),
          ];
        })
      )),

    payments: () => pays.length
      ? card({ title: 'Transactions', flush: true },
          simpleTable(
            ['When', 'Type', 'Method', { label: 'Amount', align: 'num' },
             { label: 'Fee', align: 'num' }, { label: 'Net', align: 'num' }, 'Status', 'Reference'],
            pays.map(p => [
              F.dateShort(p.created_at.slice(0, 10)),
              statusBadge(p.kind),
              p.card_last4 ? `${p.card_brand} \u00b7\u00b7\u00b7\u00b7${p.card_last4}` : F.titleCase(p.method),
              h('span', { style: { color: p.amount < 0 ? 'var(--danger)' : null } }, F.money(p.amount)),
              h('span.muted', F.money(p.fee, { blankZero: true })),
              F.money(p.net),
              statusBadge(p.status),
              h('span.small.mono.muted', p.processor_ref),
            ]),
            { footer: ['Net collected', '', '', F.money(pays.reduce((s2, p) => s2 + p.amount, 0)),
                       F.money(pays.reduce((s2, p) => s2 + p.fee, 0)),
                       F.money(pays.reduce((s2, p) => s2 + p.net, 0)), '', ''] }
          ))
      : empty('No payments recorded', 'This booking was created without taking money.'),

    answers: () => answers.length ? card({ title: 'Custom field answers' },
      kv(answers.map(a => {
        const cf = db.get('custom_field', a.custom_field);
        const bc = a.booking_customer ? db.get('booking_customer', a.booking_customer) : null;
        return [cf?.title + (bc ? ` — ${bc.name || 'guest'}` : ''), a.value];
      })))
      : empty('No answers', 'No custom fields applied to this booking, or none were answered.'),

    waivers: () => sigs.length
      ? card({ title: 'Signed waivers', flush: true },
          simpleTable(
            ['Signer', 'Template', 'Signed', 'Minor', 'IP address'],
            sigs.map(sg => [
              h('span.strong', sg.signer_name),
              db.label('waiver_template', sg.template),
              F.dateShort(sg.signed_at.slice(0, 10)),
              sg.is_minor ? badge(`Guardian: ${sg.guardian_name}`, 'warn') : '\u2014',
              h('span.small.mono.muted', sg.ip_address),
            ])
          ))
      : banner('warn', h('div',
          h('div.strong', 'No waivers on file'),
          h('div.small', item?.requires_waiver
            ? 'This item requires a waiver. Guests cannot participate until they sign.'
            : 'This item does not require a waiver.'))),

    messages: () => msgs.length
      ? card({ title: 'Messages sent', flush: true },
          simpleTable(
            ['Sent', 'Template', 'To', 'Channel', 'Status'],
            msgs.map(mg => [
              F.dateShort(mg.sent_at.slice(0, 10)),
              db.label('message_template', mg.template),
              h('span.small', mg.to),
              F.titleCase(mg.medium),
              statusBadge(mg.status),
            ])
          ))
      : empty('No messages sent yet'),

    notes: () => h('div.col',
      card({ title: 'Add a note' },
        (() => {
          let text = '', vis = 'internal';
          const ta = h('textarea.textarea', { placeholder: 'What should the team know?', oninput: (e) => { text = e.target.value; } });
          return h('div.col', ta, h('div.row',
            select([['internal', 'Internal only'], ['manifest', 'Show on manifest'], ['guest_visible', 'Visible to guest']], vis, v => { vis = v; }),
            h('div.spacer'),
            btn('Add note', {
              kind: 'primary', onclick: () => {
                if (!text.trim()) return;
                db.insert('note', {
                  target_type: 'booking', target: b.pk, visibility: vis, body: text.trim(),
                  author: ctx.store.get('currentUser')?.pk, created_at: new Date().toISOString().slice(0, 19),
                });
                toast('Note added', { tone: 'ok' }); api.refresh();
              },
            })));
        })()),
      ...notes.map(n => card({},
        h('div.row.mb-2',
          badge(F.titleCase(n.visibility), n.visibility === 'internal' ? '' : n.visibility === 'manifest' ? 'info' : 'purple'),
          h('div.spacer'),
          h('span.small.muted', `${db.label('user', n.author)} · ${F.relative(n.created_at)}`)),
        h('div', n.body)))),

    history: () => timeline([
      { title: 'Booking created', detail: `via ${db.label('channel', b.channel)}${b.created_by ? ' by ' + db.label('user', b.created_by) : ''}`, when: F.dateShort(b.created_at.slice(0, 10)) + ' · ' + F.relative(b.created_at), tone: 'info' },
      ...pays.map(p => ({
        title: p.kind === 'refund' ? `Refunded ${F.money(-p.amount)}` : `${F.titleCase(p.kind)} ${F.money(p.amount)} by ${F.titleCase(p.method)}`,
        detail: p.processor_ref, when: F.relative(p.created_at),
        tone: p.amount < 0 ? 'danger' : 'ok',
      })),
      ...sigs.slice(0, 3).map(s => ({ title: `Waiver signed by ${s.signer_name}`, when: F.relative(s.signed_at), tone: 'ok' })),
      ...(b.is_checked_in ? [{ title: 'Checked in', when: av ? F.dateShort(av.date) : '', tone: 'ok' }] : []),
      ...(b.status === 'cancelled' ? [{ title: 'Booking cancelled', when: '', tone: 'danger' }] : []),
    ].sort((a, z) => 0)),
  }[tab];

  return h('div.col', { style: { gap: 'var(--sp-4)' } },
    b.balance > 0 && banner('warn', h('div',
      h('div.strong', `${F.money(b.balance)} still due`),
      h('div.small', 'Collect at check-in or send a payment link.'))),
    b.status === 'cancelled' && banner('danger', h('div', h('div.strong', 'This booking is cancelled'),
      h('div.small', 'Its seats have been returned to the departure.'))),
    tabs(TABS, tab, setTab),
    body());
}

/* ---------------------------------------------------- booking actions */
export function takePaymentFlow(ctx, b, parent) {
  let amount = b.balance, method = 'card';
  modal({
    title: `Take payment — ${b.code}`,
    sub: `${F.money(b.balance)} outstanding of ${F.money(b.total)}`,
    render: () => h('div.grid.c2',
      h('div.field', h('label', 'Amount'),
        h('input.input', { type: 'number', step: '0.01', value: (amount / 100).toFixed(2),
          oninput: (e) => { amount = Math.round(Number(e.target.value) * 100); } })),
      h('div.field', h('label', 'Method'),
        select([['card', 'Card'], ['terminal', 'Card terminal'], ['cash', 'Cash'], ['check', 'Check'], ['gift_card', 'Gift card'], ['invoice', 'Invoice']], method, v => { method = v; }))),
    foot: (api) => [
      btn('Cancel', { onclick: api.close }),
      btn('Charge', { kind: 'primary', onclick: () => {
        ctx.domain.takePayment(b, { amount, method });
        api.close(); parent?.refresh();
        toast(`${F.money(amount)} collected`, { tone: 'ok' });
      } }),
    ],
  });
}

export function cancelFlow(ctx, b, parent) {
  const q = ctx.domain.refundQuote(b);
  let refund = q.amount, reason = '';
  modal({
    title: `Cancel ${b.code}`,
    sub: q.policy ? `${q.policy.name} — ${q.withinWindow ? 'inside the free-cancellation window' : `past cutoff, policy refunds ${F.pct(q.pct)}`}` : '',
    render: () => h('div.col',
      banner(q.withinWindow ? 'info' : 'warn',
        h('div', h('div.strong', `Policy refund: ${F.money(q.amount)}`),
          h('div.small', `Guest paid ${F.money(b.paid)}. You can override the amount below.`))),
      h('div.field', h('label', 'Refund amount'),
        h('input.input', { type: 'number', step: '0.01', value: (refund / 100).toFixed(2),
          oninput: (e) => { refund = Math.round(Number(e.target.value) * 100); } })),
      h('div.field', h('label', 'Reason (internal)'),
        h('textarea.textarea', { placeholder: 'Weather call, guest request, duplicate…', oninput: (e) => { reason = e.target.value; } }))),
    foot: (api) => [
      btn('Keep booking', { onclick: api.close }),
      btn('Cancel & refund', { kind: 'danger', onclick: () => {
        ctx.domain.cancelBooking(b, { refundAmount: refund, reason });
        api.close(); parent?.refresh();
        toast(`${b.code} cancelled`, { detail: refund ? `${F.money(refund)} refunded` : 'No refund issued', tone: 'ok' });
      } }),
    ],
  });
}

export function moveBooking(ctx, b, parent) {
  const { db, domain } = ctx;
  const from = F.today();
  const options = domain.availabilitiesFor(b.item, from, F.addDays(from, 90))
    .filter(a => a.pk !== b.availability && domain.seatsLeft(a) >= b.pax);
  let target = options[0]?.pk;
  modal({
    title: `Move ${b.code}`,
    sub: `${b.pax} guest(s) on ${db.label('item', b.item)}`,
    render: () => options.length
      ? h('div.field', h('label', 'Move to departure'),
          select(options.map(a => [a.pk, `${F.dateMed(a.date)} · ${F.time12(a.start_time)} — ${domain.seatsLeft(a)} seats free`]),
            target, v => { target = v; }))
      : empty('No departure has room', 'Every upcoming departure of this item is full or too small.'),
    foot: (api) => options.length ? [
      btn('Cancel', { onclick: api.close }),
      btn('Move booking', { kind: 'primary', onclick: () => {
        const oldAv = db.get('availability', b.availability);
        const newAv = db.get('availability', target);
        db.update('availability', oldAv.pk, { booked: Math.max(0, oldAv.booked - b.pax), status: 'open' }, { log: false });
        db.update('availability', newAv.pk, {
          booked: newAv.booked + b.pax,
          status: newAv.booked + b.pax >= newAv.capacity ? 'sold_out' : newAv.status,
        }, { log: false });
        db.update('booking', b.pk, { availability: newAv.pk });
        api.close(); parent?.refresh();
        toast('Booking moved', { detail: `${F.dateMed(newAv.date)} at ${F.time12(newAv.start_time)}`, tone: 'ok' });
      } }),
    ] : [btn('Close', { onclick: api.close })],
  });
}

/* ------------------------------------------- reusable column builders */
export function bookingColumns(ctx, { showItem = true, showDate = true } = {}) {
  const { db } = ctx;
  return [
    { key: 'code', label: 'Confirmation', width: '130px', nowrap: true,
      render: r => h('div', h('span.mono.strong', r.code),
        h('div.small.muted', F.relative(r.created_at))) },
    { key: 'contact', label: 'Guest', value: r => db.label('contact', r.contact),
      render: r => {
        const c = db.get('contact', r.contact);
        return h('div', h('div.strong', c?.name || '—'), h('div.small.muted', c?.email || ''));
      } },
    showItem && { key: 'item', label: 'Item', value: r => db.label('item', r.item),
      render: r => h('div', db.label('item', r.item)) },
    showDate && { key: 'availability', label: 'Departure',
      value: r => { const a = db.get('availability', r.availability); return a ? a.date + a.start_time : ''; },
      render: r => {
        const a = db.get('availability', r.availability);
        return a ? h('div', h('div', F.dateShort(a.date)), h('div.small.muted', F.time12(a.start_time))) : '—';
      } },
    { key: 'pax', label: 'Pax', align: 'num', width: '60px' },
    { key: 'status', label: 'Status', render: r => statusBadge(r.status) },
    { key: 'channel', label: 'Channel', value: r => db.label('channel', r.channel),
      render: r => h('span.small', db.label('channel', r.channel)) },
    { key: 'total', label: 'Total', align: 'num', fmt: F.money },
    { key: 'balance', label: 'Balance', align: 'num',
      render: r => r.balance > 0
        ? h('span.strong', { style: { color: 'var(--danger)' } }, F.money(r.balance))
        : h('span.muted', '—') },
  ].filter(Boolean);
}

/** Section header used by every module for a consistent explanation strip. */
export function moduleIntro(mod, extra) {
  return h('div.banner.info.mb-4', { style: { alignItems: 'flex-start' } },
    h('span', { style: { fontSize: '17px' } }, mod.icon),
    h('div', h('div.strong', mod.title),
      h('div.small', mod.summary),
      extra && h('div.small.mt-2', extra),
      mod.entities?.length && h('div.small.mt-2', { style: { opacity: .8 } },
        'Tables: ', ...mod.entities.map((e, i) => h('span.mono', (i ? ', ' : '') + e)))));
}
