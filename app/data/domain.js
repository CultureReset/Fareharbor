/**
 * domain.js — the platform's business rules, kept out of the UI.
 *
 * Anything that answers "what does this mean?" rather than "how does this look?"
 * lives here: how a price is built up, when a departure is full, what a refund
 * is worth under a policy, what belongs on a manifest.
 */
import { addDays, today, diffDays } from '../core/format.js';

export function createDomain(db, store) {
  const co = () => db.all('company')[0];

  const domain = {
    /* ------------------------------------------------------- capacity */
    seatsLeft: (av) => Math.max(0, (av?.capacity || 0) - (av?.booked || 0)),
    fillRate: (av) => (av?.capacity ? (av.booked || 0) / av.capacity : 0),
    /** open | tight (>=80%) | full | cancelled — drives every colour in the UI. */
    capacityState(av) {
      if (!av) return 'open';
      if (av.status === 'cancelled') return 'cancelled';
      const left = domain.seatsLeft(av);
      if (left <= 0) return 'full';
      return domain.fillRate(av) >= 0.8 ? 'tight' : 'open';
    },
    isBookable(av) {
      if (!av || av.status === 'cancelled' || av.status === 'hidden') return false;
      if (domain.seatsLeft(av) <= 0) return false;
      return av.online_status !== 'closed';
    },

    /* -------------------------------------------------------- pricing */
    ratesFor: (itemPk) => db.where('customer_type_rate', r => r.item === itemPk && r.is_active),

    /**
     * Build a full price breakdown from a cart of { rate, qty } lines.
     * This is the single place a total is computed — the booking wizard, the
     * booking detail panel and the reports all read the same numbers.
     */
    quote({ item, lines = [], promoCode = null, addons = [] }) {
      const seats = lines.filter(l => l.qty > 0);
      const subtotal = seats.reduce((s, l) => s + l.rate.total * l.qty, 0);
      const addonTotal = addons.reduce((s, a) => s + a.price * (a.qty || 1), 0);
      const pax = seats.reduce((s, l) => {
        const ct = db.get('customer_type', l.rate.customer_type);
        return s + (ct?.counts_against_capacity === false ? 0 : l.qty);
      }, 0);
      const headcount = seats.reduce((s, l) => s + l.qty, 0);

      let discount = 0, promo = null;
      if (promoCode) {
        promo = db.find('promo_code', p =>
          p.code.toLowerCase() === String(promoCode).trim().toLowerCase() && p.is_active);
        if (promo) {
          const today_ = today();
          if (promo.starts <= today_ && promo.ends >= today_ && promo.used < promo.max_uses) {
            discount = promo.kind === 'percent'
              ? Math.round((subtotal + addonTotal) * promo.value / 100)
              : Math.min(subtotal + addonTotal, promo.value);
          } else { promo = { ...promo, _invalid: true }; }
        }
      }

      const taxable = Math.max(0, subtotal + addonTotal - discount);
      const taxLines = db.where('tax_fee', t => t.is_active).map(t => {
        let amount = 0;
        if (t.calculation === 'percent') amount = Math.round(taxable * t.rate);
        else if (t.calculation === 'flat_per_booking') amount = t.rate;
        else if (t.calculation === 'flat_per_customer') amount = t.rate * headcount;
        return { ...t, amount };
      }).filter(t => t.amount > 0);

      const taxTotal = taxLines.filter(t => !t.is_inclusive).reduce((s, t) => s + t.amount, 0);
      const total = taxable + taxTotal;
      const deposit = item?.deposit_pct ? Math.round(total * item.deposit_pct) : 0;

      return {
        seats, pax, headcount, subtotal, addonTotal, discount, promo,
        taxLines, taxTotal, total, deposit, dueNow: deposit || total,
      };
    },

    /* ------------------------------------------------ availability search */
    /** Departures for an item across a date range, ordered for display. */
    availabilitiesFor(itemPk, from, to) {
      return db.where('availability', a =>
        (!itemPk || a.item === itemPk) && a.date >= from && a.date <= to
      ).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    },
    /** Everything on a given day, grouped by item — the day view and manifest. */
    dayBoard(date) {
      const avs = db.where('availability', a => a.date === date)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      return avs.map(av => {
        const bookings = db.children('booking', 'availability', av.pk)
          .filter(b => b.status !== 'cancelled');
        return {
          availability: av,
          item: db.get('item', av.item),
          bookings,
          pax: bookings.reduce((s, b) => s + b.pax, 0),
          checkedIn: bookings.filter(b => b.is_checked_in).length,
          resources: db.children('resource_assignment', 'availability', av.pk)
            .map(ra => ({ ...ra, resource: db.get('resource', ra.resource) })),
        };
      });
    },

    /* --------------------------------------------------- booking writes */
    /** Create a booking, its seats, its payment, and decrement capacity. */
    createBooking({ availability, contact, lines, promoCode, payment, channelKind = 'dashboard', notes = '', lodging = null }) {
      const item = db.get('item', availability.item);
      const q = domain.quote({ item, lines, promoCode });
      if (q.pax > domain.seatsLeft(availability))
        throw new Error(`Only ${domain.seatsLeft(availability)} seat(s) left on this departure.`);

      const channel = db.find('channel', c => c.kind === channelKind) || db.all('channel')[0];
      const me = store.get('currentUser');
      const nowIso = new Date().toISOString().slice(0, 19);
      const code = 'FH-' + (60000 + db.count('booking'));

      const booking = db.insert('booking', {
        code, company: co().pk, item: item.pk, availability: availability.pk,
        contact: contact.pk, status: 'confirmed', channel: channel.pk, affiliate: null,
        pax: q.pax, subtotal: q.subtotal, tax_total: q.taxTotal, discount_total: q.discount,
        total: q.total, paid: payment ? payment.amount : 0,
        balance: q.total - (payment ? payment.amount : 0),
        created_at: nowIso, created_by: me?.pk || null,
        promo_code: q.promo && !q.promo._invalid ? q.promo.pk : null,
        lodging, is_checked_in: false,
        waiver_status: item.requires_waiver ? 'pending' : 'not_required',
        source_url: '',
      });

      for (const line of q.seats) {
        for (let i = 0; i < line.qty; i++) {
          db.insert('booking_customer', {
            booking: booking.pk, customer_type_rate: line.rate.pk,
            name: i === 0 && line === q.seats[0] ? contact.name : '',
            email: i === 0 && line === q.seats[0] ? contact.email : '',
            phone: '', price: line.rate.total, checked_in_at: null, waiver_signed: false,
          }, { log: false });
        }
      }

      if (payment && payment.amount > 0) {
        const fee = ['cash', 'check', 'invoice'].includes(payment.method)
          ? 0 : Math.round(payment.amount * 0.029) + 30;
        db.insert('payment', {
          booking: booking.pk, kind: 'charge', method: payment.method,
          amount: payment.amount, fee, net: payment.amount - fee, status: 'succeeded',
          card_brand: payment.method === 'card' ? 'Visa' : '',
          card_last4: payment.method === 'card' ? '4242' : '',
          processor_ref: 'ch_' + Math.random().toString(36).slice(2, 12),
          created_at: nowIso, payout: null, created_by: me?.pk || null,
        }, { log: false });
      }

      if (notes.trim()) {
        db.insert('note', {
          target_type: 'booking', target: booking.pk, visibility: 'internal',
          body: notes.trim(), author: me?.pk || null, created_at: nowIso,
        }, { log: false });
      }

      if (q.promo && !q.promo._invalid) db.update('promo_code', q.promo.pk, { used: q.promo.used + 1 }, { log: false });

      db.update('availability', availability.pk, {
        booked: availability.booked + q.pax,
        status: availability.booked + q.pax >= availability.capacity ? 'sold_out' : availability.status,
      }, { log: false });

      db.update('contact', contact.pk, {
        booking_count: contact.booking_count + 1,
        lifetime_value: contact.lifetime_value + q.total,
        last_booked: nowIso.slice(0, 10),
        first_booked: contact.first_booked || nowIso.slice(0, 10),
      }, { log: false });

      store.emit('booking:created', booking);
      return booking;
    },

    /** What a guest gets back if they cancel right now, under the item's policy. */
    refundQuote(booking) {
      const item = db.get('item', booking.item);
      const av = db.get('availability', booking.availability);
      const policy = db.get('cancellation_policy', item?.cancellation_policy);
      if (!policy || !av) return { amount: booking.paid, pct: 1, policy: null, withinWindow: true };
      const hoursOut = diffDays(today(), av.date) * 24;
      const withinWindow = hoursOut >= policy.cutoff_hours;
      const pct = withinWindow ? 1 : policy.refund_pct;
      return { amount: Math.round(booking.paid * pct), pct, policy, withinWindow, hoursOut };
    },

    cancelBooking(booking, { refundAmount = 0, reason = '' } = {}) {
      const av = db.get('availability', booking.availability);
      db.update('booking', booking.pk, { status: 'cancelled', balance: 0 });
      if (av) db.update('availability', av.pk, {
        booked: Math.max(0, av.booked - booking.pax),
        status: av.status === 'sold_out' ? 'open' : av.status,
      }, { log: false });
      if (refundAmount > 0) {
        db.insert('payment', {
          booking: booking.pk, kind: 'refund', method: 'card',
          amount: -refundAmount, fee: 0, net: -refundAmount, status: 'succeeded',
          card_brand: '', card_last4: '', processor_ref: 're_' + Math.random().toString(36).slice(2, 12),
          created_at: new Date().toISOString().slice(0, 19), payout: null,
          created_by: store.get('currentUser')?.pk || null,
        }, { log: false });
        db.update('booking', booking.pk, { paid: booking.paid - refundAmount }, { log: false });
      }
      if (reason) db.insert('note', {
        target_type: 'booking', target: booking.pk, visibility: 'internal',
        body: `Cancelled: ${reason}`, author: store.get('currentUser')?.pk || null,
        created_at: new Date().toISOString().slice(0, 19),
      }, { log: false });
      store.emit('booking:cancelled', booking);
      return booking;
    },

    takePayment(booking, { amount, method = 'card' }) {
      const fee = ['cash', 'check', 'invoice'].includes(method) ? 0 : Math.round(amount * 0.029) + 30;
      db.insert('payment', {
        booking: booking.pk, kind: 'charge', method, amount, fee, net: amount - fee,
        status: 'succeeded', card_brand: method === 'card' ? 'Visa' : '',
        card_last4: method === 'card' ? '4242' : '',
        processor_ref: 'ch_' + Math.random().toString(36).slice(2, 12),
        created_at: new Date().toISOString().slice(0, 19), payout: null,
        created_by: store.get('currentUser')?.pk || null,
      });
      db.update('booking', booking.pk, {
        paid: booking.paid + amount, balance: booking.total - (booking.paid + amount),
      }, { log: false });
      store.emit('payment:taken', booking);
    },

    checkIn(booking, { device = 'dashboard' } = {}) {
      const at = new Date().toISOString().slice(0, 19);
      db.update('booking', booking.pk, { is_checked_in: true });
      db.children('booking_customer', 'booking', booking.pk)
        .forEach(bc => db.update('booking_customer', bc.pk, { checked_in_at: at }, { log: false }));
      db.insert('checkin', {
        booking: booking.pk, availability: booking.availability,
        checked_in_count: booking.pax, total_count: booking.pax, checked_in_at: at,
        by_user: store.get('currentUser')?.pk || null, device,
      }, { log: false });
      store.emit('booking:checked_in', booking);
    },

    /* -------------------------------------------------------- manifest */
    /** Everything a guide needs for one departure, on one screen. */
    manifest(availabilityPk) {
      const av = db.get('availability', availabilityPk);
      if (!av) return null;
      const item = db.get('item', av.item);
      const bookings = db.children('booking', 'availability', av.pk)
        .filter(b => b.status !== 'cancelled')
        .map(b => {
          const customers = db.children('booking_customer', 'booking', b.pk);
          return {
            booking: b,
            contact: db.get('contact', b.contact),
            customers,
            lodging: db.get('lodging', b.lodging),
            notes: db.where('note', n => n.target === b.pk && n.visibility !== 'internal'),
            internalNotes: db.where('note', n => n.target === b.pk && n.visibility === 'internal'),
            answers: db.where('custom_field_value', v => v.booking === b.pk)
              .map(v => ({ ...v, field: db.get('custom_field', v.custom_field) }))
              .filter(v => v.field?.show_on_manifest),
            waiversOutstanding: customers.filter(c => !c.waiver_signed).length,
            balance: b.balance,
          };
        })
        .sort((a, b) => (a.contact?.name || '').localeCompare(b.contact?.name || ''));
      return {
        availability: av, item,
        location: db.get('location', item?.location),
        resources: db.children('resource_assignment', 'availability', av.pk)
          .map(ra => ({ ...ra, resource: db.get('resource', ra.resource) })),
        bookings,
        pax: bookings.reduce((s, b) => s + b.booking.pax, 0),
        checkedIn: bookings.filter(b => b.booking.is_checked_in).length,
        waiversOutstanding: bookings.reduce((s, b) => s + b.waiversOutstanding, 0),
        balanceDue: bookings.reduce((s, b) => s + b.balance, 0),
      };
    },

    /* ------------------------------------------------------------ KPIs */
    /** Metrics over a date window, plus the prior window for comparison. */
    metrics(from, to) {
      const span = Math.max(1, diffDays(from, to) + 1);
      const prevFrom = addDays(from, -span), prevTo = addDays(from, -1);

      const window = (a, b) => {
        const bookings = db.where('booking', x => {
          const d = x.created_at.slice(0, 10);
          return d >= a && d <= b && x.status !== 'cancelled';
        });
        const cancelled = db.where('booking', x => {
          const d = x.created_at.slice(0, 10);
          return d >= a && d <= b && x.status === 'cancelled';
        });
        const pays = db.where('payment', p => {
          const d = p.created_at.slice(0, 10);
          return d >= a && d <= b && p.status === 'succeeded';
        });
        const departures = db.where('availability', v => v.date >= a && v.date <= b && v.status !== 'cancelled');
        const cap = departures.reduce((s, v) => s + v.capacity, 0);
        const bkd = departures.reduce((s, v) => s + v.booked, 0);
        return {
          bookings: bookings.length,
          cancelled: cancelled.length,
          revenue: bookings.reduce((s, b) => s + b.total, 0),
          collected: pays.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0),
          refunded: -pays.filter(p => p.amount < 0).reduce((s, p) => s + p.amount, 0),
          fees: pays.reduce((s, p) => s + p.fee, 0),
          pax: bookings.reduce((s, b) => s + b.pax, 0),
          avgValue: bookings.length ? Math.round(bookings.reduce((s, b) => s + b.total, 0) / bookings.length) : 0,
          departures: departures.length,
          capacity: cap, seatsSold: bkd,
          utilisation: cap ? bkd / cap : 0,
          rows: bookings,
        };
      };

      const now = window(from, to), prev = window(prevFrom, prevTo);
      const delta = (k) => prev[k] ? (now[k] - prev[k]) / prev[k] : null;
      return { now, prev, from, to, prevFrom, prevTo, delta };
    },

    /** Daily series for the sparklines and trend charts. */
    series(from, to, valueFn) {
      const out = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const rows = db.where('booking', b => b.created_at.slice(0, 10) === d && b.status !== 'cancelled');
        out.push({ date: d, value: valueFn ? valueFn(rows) : rows.reduce((s, b) => s + b.total, 0), count: rows.length });
      }
      return out;
    },

    /* ------------------------------------------------ derived worklists */
    outstandingBalances: () => db.where('booking', b => b.balance > 0 && b.status !== 'cancelled')
      .sort((a, b) => b.balance - a.balance),
    missingWaivers: () => db.where('booking', b =>
      b.waiver_status === 'pending' || b.waiver_status === 'partial')
      .filter(b => b.status === 'confirmed'),
    unassignedDepartures: (from, to) => db.where('availability', a =>
      a.date >= from && a.date <= to && a.booked > 0 && a.status !== 'cancelled'
      && db.children('resource_assignment', 'availability', a.pk).length === 0),
    company: co,
  };

  return domain;
}
