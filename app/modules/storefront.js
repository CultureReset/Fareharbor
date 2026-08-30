import { h, mount } from '../core/dom.js';
import { pageHead, card, btn, badge, stat, empty, select, kv, qty, meter, checkbox, simpleTable } from '../core/ui/kit.js';
import { modal, toast } from '../core/ui/overlay.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

/**
 * The guest side. Everything above this line in the sidebar is the operator's
 * dashboard; this is what the person actually buying a ticket sees when they
 * click a Book Now button on the operator's website.
 *
 * It reads the same items, availabilities and rates, and writing a booking here
 * shows up in Bookings, Today, the manifest and the reports immediately.
 */
export default {
  id: 'storefront',
  title: 'Guest Storefront',
  icon: '🛒',
  group: 'Reference',
  order: 290,
  hidden: true,
  summary: 'The guest-facing side: the Lightframe booking widget as a visitor experiences it.',
  entities: ['item', 'availability', 'customer_type_rate', 'booking'],

  commands: () => [{ title: 'Open the guest storefront', path: '/storefront' }],

  render(ctx) {
    const { db, domain, router, route } = ctx;
    const co = domain.company();

    const state = {
      item: route.sub === 'item' && route.id ? db.get('item', route.id) : null,
      month: F.startOfMonth(F.today()),
      date: null,
      availability: null,
      lines: {},
      contact: { name: '', email: '', phone: '' },
      promo: '',
      consent: true,
      step: 'browse',
    };
    if (state.item) state.step = 'pick';

    const host = h('div.page');

    const draw = () => {
      mount(host, h('div',
        pageHead({
          title: 'Guest Storefront',
          sub: 'The Lightframe booking flow, exactly as a visitor to your website sees it.',
          actions: [
            state.step !== 'browse' ? btn('Start over', { onclick: () => {
              Object.assign(state, { item: null, date: null, availability: null, lines: {}, step: 'browse' });
              draw();
            } }) : null,
            btn('Back to the dashboard', { onclick: () => router.go('/home') }),
          ].filter(Boolean),
        }),
        moduleIntro(this, 'Bookings made here are real: they land on the “Website — Lightframe” channel and appear immediately in Bookings, Today and every report.'),
        browserChrome(views[state.step]())));
    };

    /* --------------------------------------------------- browser frame */
    function browserChrome(inner) {
      return h('div', { style: { border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-2)' } },
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '9px 12px', background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' } },
          h('div.row', { style: { gap: '5px' } },
            ...['#f87171', '#fbbf24', '#4ade80'].map(c =>
              h('i', { style: { width: '10px', height: '10px', borderRadius: '50%', background: c, display: 'block' } }))),
          h('div', { style: { flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-pill)', padding: '4px 12px', fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' } },
            `🔒 ${co?.website?.replace('https://', '')}/tours${state.item ? '/' + state.item.slug : ''}`)),
        h('div', { style: { background: '#ffffff', color: '#16222f' } }, inner));
    }

    /* -------------------------------------------------------- site nav */
    const siteHeader = () => h('div', { style: { background: 'var(--brand-navy)', color: '#fff', padding: '16px 26px', display: 'flex', gap: '18px', alignItems: 'center' } },
      h('div', { style: { fontWeight: 800, letterSpacing: '.02em' } }, co?.name),
      h('div', { style: { display: 'flex', gap: '16px', fontSize: '13px', opacity: .85, marginLeft: '18px' } },
        ...['Tours', 'Rentals', 'About', 'Contact'].map(x => h('span', x))),
      h('div', { style: { flex: 1 } }),
      h('button.btn.primary', { onclick: () => { state.step = 'browse'; draw(); } }, 'Book Now'));

    /* ------------------------------------------------------------ views */
    const views = {
      /* the operator's website, with a Lightframe-triggering grid */
      browse: () => h('div', siteHeader(),
        h('div', { style: { padding: '26px' } },
          h('h2', { style: { margin: '0 0 4px' } }, 'Book an experience'),
          h('p', { style: { color: '#5b6b7c', fontSize: '14px' } }, 'Small groups, local guides, and the best light on the river.'),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px', marginTop: '18px' } },
            ...db.where('item', i => i.status === 'live' && i.online_booking).map(it => h('div', {
              style: { border: '1px solid #dfe5ec', borderRadius: '10px', overflow: 'hidden', background: '#fff' },
            },
              h('div', { style: { height: '110px', background: `linear-gradient(135deg, #00a0df, #0b7bc1)` } }),
              h('div', { style: { padding: '14px' } },
                h('div', { style: { fontWeight: 600 } }, it.name),
                h('div', { style: { fontSize: '12px', color: '#5b6b7c', marginTop: '5px', minHeight: '32px' } }, F.truncate(it.headline, 72)),
                h('div', { style: { display: 'flex', gap: '6px', margin: '10px 0', fontSize: '11px', color: '#5b6b7c' } },
                  h('span', F.duration(it.duration_minutes)), h('span', '·'), h('span', F.titleCase(it.category))),
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                  h('span', { style: { fontWeight: 700 } }, from(it)),
                  h('div', { style: { flex: 1 } }),
                  h('button.btn.primary.sm', { onclick: () => { state.item = it; state.step = 'pick'; draw(); } }, 'Book'))))))) ),

      /* the Lightframe overlay: date, time, party, then checkout */
      pick: () => h('div', { style: { position: 'relative' } },
        h('div', { style: { filter: 'blur(1.5px)', opacity: .5, pointerEvents: 'none' } }, views.browse()),
        h('div', { style: { position: 'absolute', inset: 0, background: 'rgba(11,37,64,.45)' } }),
        h('div', {
          style: {
            position: 'absolute', top: '18px', left: '50%', transform: 'translateX(-50%)',
            width: 'min(760px, 94%)', maxHeight: 'calc(100% - 36px)', overflowY: 'auto',
            background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,.35)',
          },
        }, lightframe())),
    };

    /* ------------------------------------------------- lightframe body */
    function lightframe() {
      const it = state.item;
      const rates = domain.ratesFor(it.pk);
      const lines = rates.map(r => ({ rate: r, qty: state.lines[r.pk] || 0 }));
      const q = domain.quote({ item: it, lines, promoCode: state.promo });

      const head = h('div', { style: { padding: '16px 20px', borderBottom: '1px solid #dfe5ec', display: 'flex', gap: '12px', alignItems: 'center' } },
        h('div', { style: { flex: 1 } },
          h('div', { style: { fontWeight: 700, fontSize: '16px' } }, it.name),
          h('div', { style: { fontSize: '12px', color: '#5b6b7c' } }, `${F.duration(it.duration_minutes)} · ${db.label('location', it.location)}`)),
        h('button.btn.ghost', { onclick: () => { state.step = 'browse'; state.item = null; draw(); } }, '✕'));

      /* month grid the guest picks a date from */
      const first = F.parseISO(state.month);
      const gridStart = F.addDays(state.month, -first.getDay());
      const days = Array.from({ length: 42 }, (_, i) => F.addDays(gridStart, i));
      const availByDate = {};
      domain.availabilitiesFor(it.pk, gridStart, F.addDays(gridStart, 41))
        .forEach(a => { if (domain.isBookable(a)) (availByDate[a.date] ||= []).push(a); });

      const calendar = h('div', { style: { padding: '18px 20px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
          h('button.btn.sm', { onclick: () => { state.month = F.addMonths(state.month, -1); draw(); } }, '‹'),
          h('div', { style: { fontWeight: 600, flex: 1, textAlign: 'center' } }, F.monthLabel(state.month)),
          h('button.btn.sm', { onclick: () => { state.month = F.addMonths(state.month, 1); draw(); } }, '›')),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', fontSize: '11px', color: '#8a9aab', textAlign: 'center', marginBottom: '4px' } },
          ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => h('div', d))),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' } },
          ...days.map(d => {
            const has = (availByDate[d] || []).length;
            const isMonth = d.slice(0, 7) === state.month.slice(0, 7);
            const past = d < F.today();
            return h('button', {
              disabled: !has || past,
              style: {
                aspectRatio: '1', border: state.date === d ? '2px solid #0b7bc1' : '1px solid #dfe5ec',
                borderRadius: '7px', background: !has || past ? '#f8fafc' : '#fff',
                color: !isMonth ? '#c3ccd7' : !has || past ? '#c3ccd7' : '#16222f',
                cursor: has && !past ? 'pointer' : 'default', fontSize: '13px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                fontWeight: state.date === d ? 700 : 400,
              },
              onclick: () => { state.date = d; state.availability = null; draw(); },
            }, h('span', String(F.parseISO(d).getDate())),
               has && !past ? h('i', { style: { width: '4px', height: '4px', borderRadius: '50%', background: '#0b7bc1', display: 'block' } }) : null);
          })));

      const times = state.date ? h('div', { style: { padding: '0 20px 18px' } },
        h('div', { style: { fontWeight: 600, fontSize: '13px', marginBottom: '8px' } }, F.dateLong(state.date)),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          ...(availByDate[state.date] || []).map(a => h('button.btn', {
            class: state.availability?.pk === a.pk ? 'primary' : '',
            onclick: () => { state.availability = a; draw(); },
          }, h('span', F.time12(a.start_time)),
             h('span', { style: { fontSize: '11px', opacity: .75, marginLeft: '6px' } }, `${domain.seatsLeft(a)} left`))))) : null;

      const party = state.availability ? h('div', { style: { padding: '0 20px 18px', borderTop: '1px solid #dfe5ec', paddingTop: '16px' } },
        h('div', { style: { fontWeight: 600, fontSize: '13px', marginBottom: '10px' } }, 'How many?'),
        ...rates.map(r => {
          const ct = db.get('customer_type', r.customer_type);
          const n = state.lines[r.pk] || 0;
          const used = q.pax;
          const room = domain.seatsLeft(state.availability) - used + (ct?.counts_against_capacity === false ? 99 : n);
          return h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' } },
            h('div', { style: { flex: 1 } },
              h('div', { style: { fontWeight: 500 } }, ct?.plural),
              h('div', { style: { fontSize: '12px', color: '#5b6b7c' } }, ct?.note || '')),
            h('div', { style: { fontWeight: 600 } }, F.money(r.total)),
            qty(n, v => { state.lines[r.pk] = v; draw(); }, { min: 0, max: n + Math.max(0, room) }));
        })) : null;

      const checkout = q.headcount > 0 ? h('div', { style: { padding: '16px 20px', borderTop: '1px solid #dfe5ec' } },
        h('div', { style: { fontWeight: 600, fontSize: '13px', marginBottom: '10px' } }, 'Your details'),
        h('div.grid.c3',
          h('div.field', h('label', 'Name'), h('input.input', { value: state.contact.name, oninput: e => { state.contact.name = e.target.value; } })),
          h('div.field', h('label', 'Email'), h('input.input', { type: 'email', value: state.contact.email, oninput: e => { state.contact.email = e.target.value; } })),
          h('div.field', h('label', 'Phone'), h('input.input', { value: state.contact.phone, oninput: e => { state.contact.phone = e.target.value; } }))),
        h('div.field', { style: { marginTop: '10px', maxWidth: '240px' } },
          h('label', 'Promo code'),
          h('input.input', { value: state.promo, style: 'text-transform:uppercase',
            onchange: e => { state.promo = e.target.value.toUpperCase(); draw(); } })),
        state.promo && q.promo?._invalid
          ? h('div', { style: { color: '#b91c1c', fontSize: '12px', marginTop: '6px' } }, `“${state.promo}” isn’t valid.`)
          : q.discount ? h('div', { style: { color: '#15803d', fontSize: '12px', marginTop: '6px' } }, `${q.promo.code} applied — you saved ${F.money(q.discount)}.`) : null,
        h('div', { style: { marginTop: '12px' } },
          checkbox('Email me occasional offers', state.consent, v => { state.consent = v; })),
        h('div', { style: { marginTop: '16px', background: '#f8fafc', borderRadius: '8px', padding: '14px' } },
          h('dl.kv',
            ...q.seats.flatMap(s => [
              h('dt', `${s.qty} × ${db.get('customer_type', s.rate.customer_type)?.singular}`),
              h('dd.right', F.money(s.rate.total * s.qty)),
            ]),
            q.discount ? h('dt', { style: { color: '#15803d' } }, 'Discount') : null,
            q.discount ? h('dd.right', { style: { color: '#15803d' } }, '−' + F.money(q.discount)) : null,
            ...q.taxLines.flatMap(t => [h('dt', t.name), h('dd.right', F.money(t.amount))]),
            h('dt', { style: { fontWeight: 700, color: '#16222f' } }, 'Total'),
            h('dd.right', { style: { fontWeight: 700 } }, F.money(q.total)))),
        it.requires_waiver ? h('div', { style: { fontSize: '12px', color: '#b45309', marginTop: '10px' } },
          '⚠ Every guest must sign a waiver before departure. We will email a link straight after you book.') : null,
        (() => { const p = db.get('cancellation_policy', it.cancellation_policy);
          return p ? h('div', { style: { fontSize: '12px', color: '#5b6b7c', marginTop: '8px' } }, p.description) : null; })(),
        h('button.btn.primary.lg.block', { style: { marginTop: '14px' }, onclick: () => place(q) },
          `Pay ${F.money(q.deposit || q.total)} and book`)) : null;

      return h('div', head, calendar, times, party, checkout);
    }

    function place(q) {
      if (!state.contact.name.trim() || !state.contact.email.trim())
        return toast('Name and email are required', { tone: 'warn' });

      const existing = db.find('contact', c => c.email?.toLowerCase() === state.contact.email.toLowerCase());
      const contact = existing || db.insert('contact', {
        company: co.pk, name: state.contact.name.trim(), email: state.contact.email.trim(),
        phone: state.contact.phone.trim(), country: 'US', city: '',
        marketing_opt_in: state.consent, booking_count: 0, lifetime_value: 0,
        first_booked: null, last_booked: null, tags: [], notes: '',
      });

      const rates = domain.ratesFor(state.item.pk);
      const lines = rates.map(r => ({ rate: r, qty: state.lines[r.pk] || 0 }));

      let booking;
      try {
        booking = domain.createBooking({
          availability: state.availability, contact, lines, promoCode: state.promo,
          payment: { amount: q.deposit || q.total, method: 'card' },
          channelKind: 'direct_online',
        });
      } catch (err) {
        return toast('Could not complete the booking', { detail: err.message, tone: 'danger' });
      }
      db.update('booking', booking.pk, { source_url: `${co.website}/tours/${state.item.slug}` }, { log: false });

      modal({
        title: 'You’re booked',
        sub: booking.code,
        render: () => h('div.col',
          h('div.banner.ok', h('div',
            h('div.strong', `${state.item.name} — ${F.dateLong(state.availability.date)}`),
            h('div.small', `${F.time12(state.availability.start_time)} · ${booking.pax} guests · ${db.label('location', state.item.location)}`))),
          kv([
            ['Confirmation', h('span.mono.strong', booking.code)],
            ['Paid', F.money(booking.paid)],
            ['Balance', F.money(booking.balance)],
            ['Confirmation sent to', contact.email],
          ]),
          h('p.small.muted.mt-3', 'On the operator’s side this booking is now visible in Bookings, on Today’s departure board, on the manifest, and in every report — attributed to the “Website — Lightframe” channel.')),
        foot: (api) => [
          btn('Book something else', { onclick: () => { api.close(); Object.assign(state, { item: null, date: null, availability: null, lines: {}, step: 'browse' }); draw(); } }),
          btn('See it in the dashboard', { kind: 'primary', onclick: () => { api.close(); router.go(`/bookings/detail/${booking.pk}`); } }),
        ],
      });
    }

    function from(it) {
      const rs = domain.ratesFor(it.pk).map(r => r.total).filter(x => x > 0);
      return rs.length ? `From ${F.money(Math.min(...rs))}` : '—';
    }

    draw();
    return host;
  },
};
