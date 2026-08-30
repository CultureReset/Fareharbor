import { h, mount } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, stepper, qty, meter, checkbox, avatar } from '../core/ui/kit.js';
import { modal, toast } from '../core/ui/overlay.js';
import { openBooking, moduleIntro, capacityCell } from './_shared.js';
import * as F from '../core/format.js';

/**
 * The internal booking flow. This is the screen a front-desk agent uses on the
 * phone: pick the item, pick the departure, build the party, attach a guest,
 * answer the custom fields, take money.
 *
 * It is genuinely functional — completing it writes a booking, its customers,
 * its payment and its custom field answers, decrements the departure's capacity
 * and rolls up the contact's lifetime value.
 */
export default {
  id: 'book',
  title: 'New Booking',
  icon: '＋',
  group: 'Reference',
  order: 280,
  hidden: true,
  summary: 'The internal booking flow an agent uses to take a reservation over the phone or at the desk.',
  entities: ['booking', 'availability', 'customer_type_rate', 'payment', 'contact'],

  commands: () => [{ title: 'Take a new booking', path: '/book' }],

  render(ctx) {
    const { db, domain, router, route } = ctx;

    /* wizard state lives for the life of this render tree */
    const state = {
      step: 0,
      item: route.query.item ? db.get('item', route.query.item) : null,
      availability: null,
      date: F.today(),
      lines: {},                       // rate.pk -> qty
      contact: route.query.contact ? db.get('contact', route.query.contact) : null,
      newContact: { name: '', email: '', phone: '' },
      promo: '',
      answers: {},
      lodging: '',
      notes: '',
      payMethod: 'card',
      payNow: true,
    };
    if (route.sub === 'slot' && route.id) {
      state.availability = db.get('availability', route.id);
      state.item = db.get('item', state.availability?.item);
      state.date = state.availability?.date || state.date;
      state.step = 1;
    }
    if (state.item && state.step === 0) state.step = 1;

    const host = h('div.page');
    const STEPS = ['Item', 'Departure', 'Guests', 'Details', 'Payment'];

    const draw = () => {
      const rates = state.item ? domain.ratesFor(state.item.pk) : [];
      const lines = rates.map(r => ({ rate: r, qty: state.lines[r.pk] || 0 }));
      const quote = state.item ? domain.quote({ item: state.item, lines, promoCode: state.promo }) : null;

      mount(host, h('div',
        pageHead({
          title: 'New booking',
          sub: 'The flow your team uses on the phone and at the desk.',
          actions: [btn('Cancel', { onclick: () => router.go('/bookings') })],
        }),
        moduleIntro(this, 'This wizard writes real rows. Finishing it creates a booking, its per-guest seats, a payment, and decrements the departure’s capacity — then the booking appears everywhere else in the dashboard.'),
        h('div.mb-4', stepper(STEPS, state.step)),
        h('div.grid.side',
          h('div', panes[state.step]()),
          summary(quote))));
    };

    const go = (n) => { state.step = n; draw(); };

    /* ------------------------------------------------------ step panes */
    const panes = [
      /* 0 — choose an item */
      () => card({ title: 'What are they booking?', flush: true },
        h('div.grid.c3', { style: { padding: 'var(--sp-4)' } },
          ...db.where('item', i => i.status === 'live').map(it => h('button', {
            style: {
              textAlign: 'left', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              padding: '14px', background: 'var(--surface)', cursor: 'pointer',
            },
            onclick: () => { state.item = it; state.availability = null; state.lines = {}; go(1); },
          },
            h('div.strong', it.name),
            h('div.small.muted.mt-2', F.truncate(it.headline, 70)),
            h('div.row.mt-3', badge(F.titleCase(it.category)), badge(F.duration(it.duration_minutes)),
              it.requires_waiver ? badge('Waiver', 'warn') : null),
            h('div.mt-3.strong', priceRange(ctx, it)))))),

      /* 1 — choose a departure */
      () => {
        const from = state.date;
        const list = domain.availabilitiesFor(state.item.pk, from, F.addDays(from, 13));
        const byDate = {};
        list.forEach(a => { (byDate[a.date] ||= []).push(a); });
        return card({
          title: `When? — ${state.item.name}`,
          sub: 'Next two weeks. Sold-out and closed departures are shown but cannot be selected.',
          actions: [
            h('input.input', { type: 'date', value: state.date, style: 'width:auto',
              onchange: e => { state.date = e.target.value; draw(); } }),
            btn('Change item', { size: 'sm', onclick: () => go(0) }),
          ],
        },
          Object.keys(byDate).length ? h('div.col', ...Object.entries(byDate).map(([date, avs]) =>
            h('div', { style: { paddingBottom: '12px', borderBottom: '1px solid var(--border)' } },
              h('div.small.strong.mb-2', F.dateLong(date)),
              h('div.row', ...avs.map(a => {
                const bookable = domain.isBookable(a);
                const left = domain.seatsLeft(a);
                const b = btn(`${F.time12(a.start_time)} · ${left} left`, {
                  size: 'sm', disabled: !bookable,
                  kind: state.availability?.pk === a.pk ? 'primary' : '',
                  onclick: () => { state.availability = a; go(2); },
                });
                if (!bookable) b.title = a.status === 'cancelled' ? 'Cancelled' : left <= 0 ? 'Sold out' : 'Closed';
                return b;
              })))))
            : empty('No departures in this window', 'Try a different date, or add departures from the calendar.',
                btn('Open calendar', { kind: 'primary', onclick: () => router.go('/calendar', { item: state.item.pk }) })));
      },

      /* 2 — build the party */
      () => {
        const rates = domain.ratesFor(state.item.pk);
        const used = rates.reduce((s, r) => {
          const ct = db.get('customer_type', r.customer_type);
          return s + (ct?.counts_against_capacity === false ? 0 : (state.lines[r.pk] || 0));
        }, 0);
        const left = domain.seatsLeft(state.availability) - used;
        return card({
          title: 'Who is coming?',
          sub: `${domain.seatsLeft(state.availability)} seats free on ${F.dateMed(state.availability.date)} at ${F.time12(state.availability.start_time)}`,
          actions: [btn('Change departure', { size: 'sm', onclick: () => go(1) })],
        },
          h('div.col', ...rates.map(r => {
            const ct = db.get('customer_type', r.customer_type);
            const n = state.lines[r.pk] || 0;
            return h('div.row', { style: { padding: '10px 0', borderBottom: '1px solid var(--border)' } },
              h('div', { style: { flex: 1 } },
                h('div.strong', ct?.plural || ct?.singular),
                h('div.small.muted', [ct?.note, ct?.counts_against_capacity === false ? 'Does not use a seat' : null].filter(Boolean).join(' · '))),
              h('div.strong', { style: { minWidth: '80px', textAlign: 'right' } }, F.money(r.total)),
              h('div', { style: { marginLeft: '16px' } },
                qty(n, (v) => { state.lines[r.pk] = v; draw(); },
                  { min: 0, max: n + Math.max(0, left) })));
          })),
          left <= 0 ? h('div.banner.warn.mt-3', h('div', h('div.strong', 'Departure is now full'),
            h('div.small', 'Reduce the party, or move to another departure.'))) : null,
          h('div.row.mt-4',
            btn('Back', { onclick: () => go(1) }),
            h('div.spacer'),
            btn('Continue', { kind: 'primary', disabled: used === 0, onclick: () => go(3) })));
      },

      /* 3 — guest details and custom fields */
      () => {
        const fields = db.where('custom_field', c => c.level === 'booking');
        const recent = db.all('contact').filter(c => c.booking_count > 0).slice(0, 8);
        return h('div.col',
          card({ title: 'Who is the booking for?' },
            state.contact
              ? h('div',
                  h('div.row', avatar(state.contact.name),
                    h('div', { style: { flex: 1 } },
                      h('div.strong', state.contact.name),
                      h('div.small.muted', `${state.contact.email} · ${F.phone(state.contact.phone)}`),
                      h('div.small.muted', `${state.contact.booking_count} previous bookings · ${F.money(state.contact.lifetime_value)} lifetime`)),
                    btn('Change', { size: 'sm', onclick: () => { state.contact = null; draw(); } })))
              : h('div.col',
                  h('div.grid.c3',
                    h('div.field', h('label', 'Name'),
                      h('input.input', { value: state.newContact.name, placeholder: 'Maya Okafor',
                        oninput: e => { state.newContact.name = e.target.value; } })),
                    h('div.field', h('label', 'Email'),
                      h('input.input', { type: 'email', value: state.newContact.email, placeholder: 'maya@example.com',
                        oninput: e => { state.newContact.email = e.target.value; } })),
                    h('div.field', h('label', 'Phone'),
                      h('input.input', { value: state.newContact.phone, placeholder: '503 555 0142',
                        oninput: e => { state.newContact.phone = e.target.value; } }))),
                  h('div.mt-3', h('div.small.strong.mb-2', 'Or pick an existing guest'),
                    h('div.row', ...recent.map(c => btn(c.name, {
                      size: 'sm', onclick: () => { state.contact = c; draw(); },
                    }))))) ),

          fields.length ? card({ title: 'Booking questions' },
            h('div.grid.c2', ...fields.map(cf => h('div.field', { style: cf.type === 'long_text' ? { gridColumn: '1 / -1' } : null },
              h('label', cf.title, cf.is_required ? h('span', { style: { color: 'var(--danger)' } }, ' *') : null),
              cf.type === 'select'
                ? select([['', '— choose —'], ...(cf.options || []).map(o => [o, o])], state.answers[cf.pk] || '', v => { state.answers[cf.pk] = v; })
                : cf.type === 'checkbox'
                ? checkbox('Yes', state.answers[cf.pk] === 'Yes', v => { state.answers[cf.pk] = v ? 'Yes' : ''; })
                : cf.type === 'long_text'
                ? h('textarea.textarea', { oninput: e => { state.answers[cf.pk] = e.target.value; } })
                : h('input.input', { type: cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text',
                    oninput: e => { state.answers[cf.pk] = e.target.value; } }),
              cf.description ? h('div.hint', cf.description) : null)))) : null,

          card({ title: 'Logistics' }, h('div.grid.c2',
            h('div.field', h('label', 'Hotel pickup'),
              select([['', 'Meets on site'], ...db.where('lodging', l => l.is_active).map(l => [l.pk, `${l.name} — ${Math.abs(l.pickup_offset_minutes)} min before`])],
                state.lodging, v => { state.lodging = v; })),
            h('div.field', h('label', 'Promo code'),
              h('input.input', { value: state.promo, placeholder: 'LOCALS20',
                style: 'text-transform:uppercase',
                onchange: e => { state.promo = e.target.value.toUpperCase(); draw(); } })),
            h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Internal note'),
              h('textarea.textarea', { value: state.notes, placeholder: 'Anything the crew should know',
                oninput: e => { state.notes = e.target.value; } })))),

          h('div.row',
            btn('Back', { onclick: () => go(2) }),
            h('div.spacer'),
            btn('Continue to payment', { kind: 'primary', onclick: () => {
              if (!state.contact && !state.newContact.name.trim())
                return toast('Enter a guest name', { tone: 'warn' });
              go(4);
            } })));
      },

      /* 4 — take payment and confirm */
      () => {
        const rates = domain.ratesFor(state.item.pk);
        const lines = rates.map(r => ({ rate: r, qty: state.lines[r.pk] || 0 }));
        const q = domain.quote({ item: state.item, lines, promoCode: state.promo });
        return h('div.col',
          card({ title: 'Payment' }, h('div.col',
            h('div.grid.c2',
              h('div.field', h('label', 'Method'),
                select([['card', 'Card — keyed in'], ['terminal', 'Card terminal'], ['cash', 'Cash'],
                        ['check', 'Check'], ['gift_card', 'Gift card'], ['invoice', 'Invoice the affiliate']],
                  state.payMethod, v => { state.payMethod = v; })),
              h('div.field', h('label', 'Amount to take now'),
                select(q.deposit
                  ? [['deposit', `Deposit — ${F.money(q.deposit)}`], ['full', `Full — ${F.money(q.total)}`], ['none', 'Nothing now']]
                  : [['full', `Full — ${F.money(q.total)}`], ['none', 'Nothing now — leave a balance']],
                  state.payNow === false ? 'none' : q.deposit ? 'deposit' : 'full',
                  v => { state.payAmountMode = v; state.payNow = v !== 'none'; draw(); }))),
            state.payMethod === 'card' ? h('div.grid.c3.mt-3',
              h('div.field', h('label', 'Card number'), h('input.input', { placeholder: '4242 4242 4242 4242' })),
              h('div.field', h('label', 'Expiry'), h('input.input', { placeholder: 'MM / YY' })),
              h('div.field', h('label', 'CVC'), h('input.input', { placeholder: '123' }))) : null,
            state.payMethod === 'terminal' ? h('div.banner.info.mt-3',
              h('div', h('div.strong', 'Waiting for the reader'),
                h('div.small', 'Reader “Desk 1” is online. Ask the guest to tap or insert.'))) : null)),

          card({ title: 'Confirm' },
            kv([
              ['Item', state.item.name],
              ['Departure', `${F.dateLong(state.availability.date)} · ${F.time12(state.availability.start_time)}`],
              ['Party', q.seats.map(s => `${s.qty} × ${db.get('customer_type', s.rate.customer_type)?.singular}`).join(', ')],
              ['Guest', state.contact?.name || state.newContact.name],
              ['Pickup', state.lodging ? db.label('lodging', state.lodging) : 'Meets on site'],
              ['Total', h('span.strong', F.money(q.total))],
              ['Taking now', h('span.strong', F.money(paymentAmount(q)))],
            ]),
            state.item.requires_waiver ? h('div.banner.warn.mt-3', h('div',
              h('div.strong', 'This item requires a signed waiver'),
              h('div.small', 'Every guest gets a signing link in their confirmation email.'))) : null),

          h('div.row',
            btn('Back', { onclick: () => go(3) }),
            h('div.spacer'),
            btn(`Confirm booking — ${F.money(q.total)}`, { kind: 'primary', size: 'lg', onclick: () => confirmBooking(q) })));
      },
    ];

    function paymentAmount(q) {
      if (!state.payNow) return 0;
      if (state.payAmountMode === 'deposit' && q.deposit) return q.deposit;
      if (state.payAmountMode === 'full') return q.total;
      return q.deposit || q.total;
    }

    /* ------------------------------------------------------ live summary */
    function summary(q) {
      if (!state.item) return card({ title: 'Order' }, h('p.small.muted', 'Pick an item to start.'));
      const seatCount = q ? q.headcount : 0;
      return h('div.col', { style: { position: 'sticky', top: 'var(--sp-4)' } },
        card({ title: 'Order summary' },
          kv([
            ['Item', state.item.name],
            ['Departure', state.availability
              ? `${F.dateMed(state.availability.date)} · ${F.time12(state.availability.start_time)}`
              : h('span.muted', 'Not chosen')],
            ['Guests', seatCount || h('span.muted', 'None yet')],
            ['Guest', state.contact?.name || state.newContact.name || h('span.muted', 'Not entered')],
          ]),
          q && q.headcount > 0 ? h('div', h('div.divider'),
            h('dl.kv',
              ...q.seats.flatMap(s => [
                h('dt', `${s.qty} × ${db.get('customer_type', s.rate.customer_type)?.singular}`),
                h('dd.right', F.money(s.rate.total * s.qty)),
              ]),
              q.discount ? h('dt', { style: { color: 'var(--ok)' } }, `Discount ${q.promo?.code || ''}`) : null,
              q.discount ? h('dd.right', { style: { color: 'var(--ok)' } }, '−' + F.money(q.discount)) : null,
              ...q.taxLines.flatMap(t => [h('dt.small', t.name), h('dd.right.small', F.money(t.amount))]),
              h('dt', { style: { fontWeight: 700, color: 'var(--fg)' } }, 'Total'),
              h('dd.right.strong', F.money(q.total)),
              q.deposit ? h('dt', 'Deposit due now') : null,
              q.deposit ? h('dd.right', F.money(q.deposit)) : null)) : null,
          state.promo && q?.promo?._invalid
            ? h('div.banner.danger.mt-3', h('div.small', `“${state.promo}” is not valid right now.`)) : null),
        state.availability ? card({ title: 'Departure' },
          capacityCell(ctx, state.availability),
          h('div.small.muted.mt-2', db.label('location', state.item.location))) : null);
    }

    /* ------------------------------------------------------ commit */
    function confirmBooking(q) {
      let contact = state.contact;
      if (!contact) {
        const existing = state.newContact.email
          ? db.find('contact', c => c.email?.toLowerCase() === state.newContact.email.toLowerCase()) : null;
        contact = existing || db.insert('contact', {
          company: domain.company().pk,
          name: state.newContact.name.trim(),
          email: state.newContact.email.trim(),
          phone: state.newContact.phone.trim(),
          country: 'US', city: '', marketing_opt_in: false,
          booking_count: 0, lifetime_value: 0, first_booked: null, last_booked: null,
          tags: [], notes: '',
        });
      }

      const rates = domain.ratesFor(state.item.pk);
      const lines = rates.map(r => ({ rate: r, qty: state.lines[r.pk] || 0 }));
      const amount = paymentAmount(q);

      let booking;
      try {
        booking = domain.createBooking({
          availability: state.availability,
          contact, lines, promoCode: state.promo,
          payment: amount > 0 ? { amount, method: state.payMethod } : null,
          channelKind: 'dashboard',
          notes: state.notes,
          lodging: state.lodging || null,
        });
      } catch (err) {
        return toast('Could not create the booking', { detail: err.message, tone: 'danger' });
      }

      for (const [cfPk, value] of Object.entries(state.answers)) {
        if (!value) continue;
        db.insert('custom_field_value', { custom_field: cfPk, booking: booking.pk, booking_customer: null, value }, { log: false });
      }
      db.insert('message_log', {
        template: db.find('message_template', t => t.trigger === 'booking_confirmed')?.pk,
        booking: booking.pk, to: contact.email, medium: 'email',
        subject: `Your ${state.item.name} is confirmed`, status: 'delivered',
        sent_at: new Date().toISOString().slice(0, 19),
      }, { log: false });

      modal({
        title: 'Booking confirmed',
        sub: booking.code,
        render: () => h('div.col',
          h('div.banner.ok', h('div',
            h('div.strong', `${booking.code} created`),
            h('div.small', `${booking.pax} guests on ${state.item.name}, ${F.dateLong(state.availability.date)} at ${F.time12(state.availability.start_time)}.`))),
          kv([
            ['Total', F.money(booking.total)],
            ['Paid', F.money(booking.paid)],
            ['Balance', booking.balance > 0 ? h('span.strong', { style: { color: 'var(--danger)' } }, F.money(booking.balance)) : F.money(0)],
            ['Confirmation sent to', contact.email || '—'],
            ['Seats left on this departure', String(domain.seatsLeft(db.get('availability', state.availability.pk)))],
          ])),
        foot: (api) => [
          btn('Take another booking', { onclick: () => { api.close(); router.go('/book'); } }),
          btn('Open the booking', { kind: 'primary', onclick: () => { api.close(); router.go(`/bookings/detail/${booking.pk}`); } }),
        ],
      });
    }

    draw();
    return host;
  },
};

function priceRange(ctx, it) {
  const rs = ctx.domain.ratesFor(it.pk).map(r => r.total).filter(x => x > 0);
  if (!rs.length) return 'No rates set';
  const lo = Math.min(...rs), hi = Math.max(...rs);
  return lo === hi ? F.money(lo) : `From ${F.money(lo)}`;
}
