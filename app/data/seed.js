/**
 * seed.js — deterministic demo dataset.
 *
 * Same seed => same data on every reload, so screenshots and links are stable.
 * Everything reconciles: booking totals equal the sum of their customers plus
 * taxes minus discounts; payouts equal the payments they contain; availability
 * `booked` counts equal the pax actually on their bookings.
 */
import { toISO, addDays, today, pad } from '../core/format.js';

/* ---------------------------------------------------------- randomness */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generate(seed = 20260830) {
  const R = rng(seed);
  const int = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const weighted = (pairs) => {                  // [[value, weight], ...]
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = R() * total;
    for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
    return pairs[pairs.length - 1][0];
  };
  const chance = (p) => R() < p;
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const counter = {};
  const id = (t) => `${t}_${String(counter[t] = (counter[t] || 0) + 1).padStart(5, '0')}`;

  const T0 = today();
  const dtOffset = (days, hour = int(8, 19)) =>
    `${addDays(T0, days)}T${pad(hour)}:${pad(int(0, 59))}:00`;

  /* ------------------------------------------------------------ vocab */
  const FIRST = ['Maya','Liam','Sofia','Noah','Ava','Ethan','Isla','Kai','Nora','Owen','Ruby','Leo','Zoe','Mateo','Hazel','Felix','Iris','Jonah','Elena','Rhys','Priya','Tomas','Anika','Callum','Yuki','Diego','Freya','Omar','Lena','Beau','Sana','Marcus','Ingrid','Theo','Camille','Hugo','Nadia','Silas','Amara','Jasper'];
  const LAST = ['Okafor','Nakamura','Delgado','Whitfield','Byrne','Halvorsen','Ferreira','Mbeki','Larsen','Costa','Ahmadi','Sinclair','Prasad','Novak','Rivera','Ellison','Tanaka','Bouchard','Grimaldi','Osei','Vasquez','Lindqvist','Marchetti','Odell','Kowalski','Bright','Ferris','Achebe','Solberg','Ibarra','Kaur','Renner','Duarte','Fontaine','Hollis','Mensah','Petrov','Quill','Salazar','Trevino'];
  const CITIES = [['Portland','US'],['Austin','US'],['Toronto','CA'],['London','GB'],['Sydney','AU'],['Berlin','DE'],['Denver','US'],['Chicago','US'],['Dublin','IE'],['Auckland','NZ'],['Vancouver','CA'],['Lisbon','PT'],['Seattle','US'],['Amsterdam','NL'],['Osaka','JP'],['Boston','US'],['Barcelona','ES'],['Oslo','NO']];
  const DOMAINS = ['gmail.com','outlook.com','icloud.com','fastmail.com','proton.me','hey.com'];

  const out = {};
  const add = (t, row) => { (out[t] ||= []).push(row); return row; };

  /* ---------------------------------------------------------- company */
  const company = add('company', {
    pk: id('company'), shortname: 'harbor-line-adventures', name: 'Harbor Line Adventures',
    timezone: 'America/Los_Angeles', currency: 'USD', country: 'US',
    phone: '5035550142', email: 'crew@harborline.example', website: 'https://harborline.example',
    address: '1420 Waterfront Way, Astoria, OR 97103', status: 'active', logo_color: '#0b7bc1',
  });
  const CO = company.pk;

  /* -------------------------------------------------------- locations */
  const LOCS = [
    ['Pier 12 Ticket Office', 'office', '1420 Waterfront Way, Astoria, OR'],
    ['North Dock', 'dock', '9 Harbor Loop, Astoria, OR'],
    ['Cape Trail Head', 'meeting_point', 'Cape Disappointment State Park'],
    ['Downtown Rental Shop', 'shop', '88 Commercial St, Astoria, OR'],
    ['Bay Marina Slip 4', 'dock', 'Bay Marina, Warrenton, OR'],
    ['Gear Warehouse', 'warehouse', '12 Industrial Ct, Astoria, OR'],
  ];
  const locations = LOCS.map(([name, kind, address], i) => add('location', {
    pk: id('location'), company: CO, name, kind, address,
    lat: 46.18 + R() * 0.1, lng: -123.83 + R() * 0.1,
    directions: 'Free parking on the north side; check in 20 minutes before departure.',
    is_active: i !== 5,
  }));

  /* ------------------------------------------------------------ roles */
  const ROLE_DEFS = [
    ['Owner', 'Unrestricted access including payouts, users and company settings.', ['*']],
    ['Manager', 'Runs the day: bookings, items, schedules, refunds and reports.', ['bookings.*','items.*','reports.view','payments.refund','contacts.*','resources.*']],
    ['Front Desk', 'Takes bookings and payments; cannot change pricing or issue payouts.', ['bookings.create','bookings.edit','payments.charge','contacts.view','checkin.*']],
    ['Guide', 'Sees today’s manifest and checks guests in. No money access.', ['manifest.view','checkin.*','bookings.view']],
    ['Accountant', 'Read-only across sales, plus payouts, taxes and exports.', ['reports.*','payouts.view','payments.view','exports.*']],
    ['Read Only', 'Can look at everything, can change nothing.', ['*.view']],
  ];
  const roles = ROLE_DEFS.map(([name, description, permissions], i) => add('role', {
    pk: id('role'), company: CO, name, description, permissions,
    is_system: i < 2, user_count: 0,
  }));

  /* ------------------------------------------------------------ users */
  const USER_DEFS = [
    ['Dana Whitfield', 0], ['Priya Raman', 1], ['Marcus Odell', 1], ['Kai Halvorsen', 2],
    ['Nora Byrne', 2], ['Elena Costa', 2], ['Jonah Ferris', 3], ['Ruby Achebe', 3],
    ['Silas Bright', 3], ['Tomas Novak', 3], ['Ingrid Solberg', 4], ['Camille Duarte', 5],
  ];
  const users = USER_DEFS.map(([name, roleIdx], i) => {
    roles[roleIdx].user_count++;
    return add('user', {
      pk: id('user'), company: CO, name,
      email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@harborline.example',
      phone: '503555' + String(1000 + i * 7).slice(0, 4),
      role: roles[roleIdx].pk,
      status: i === 11 ? 'invited' : i === 10 && chance(.3) ? 'disabled' : 'active',
      last_login: dtOffset(-int(0, 14)),
      two_factor: roleIdx <= 1 || chance(.4),
      location_scope: roleIdx === 3 ? [locations[int(0, 2)].pk] : [],
    });
  });
  const staff = users.filter(u => u.status === 'active');

  /* -------------------------------------------- cancellation policies */
  const policies = [
    ['Flexible — 24 hours', 24, 100, 'Full refund if cancelled at least 24 hours before departure.'],
    ['Standard — 48 hours', 48, 50, 'Full refund up to 48 hours out, then 50% back.'],
    ['Strict — 7 days', 168, 0, 'Full refund up to 7 days out. No refund after that; reschedule once at no cost.'],
  ].map(([name, cutoff_hours, refund_pct, description]) => add('cancellation_policy', {
    pk: id('cancellation_policy'), company: CO, name, cutoff_hours, refund_pct: refund_pct / 100, description,
  }));

  /* --------------------------------------------------- customer types */
  const CT_DEFS = [
    ['Adult', 'Adults', 'Ages 13+', true],
    ['Child', 'Children', 'Ages 4–12', true],
    ['Infant', 'Infants', 'Under 4, on a lap', false],
    ['Senior', 'Seniors', 'Ages 65+', true],
    ['Student', 'Students', 'Valid ID required', true],
    ['Observer', 'Observers', 'Rides along, does not participate', true],
  ];
  const ctypes = CT_DEFS.map(([singular, plural, note, counts]) => add('customer_type', {
    pk: id('customer_type'), company: CO, singular, plural, note, counts_against_capacity: counts,
  }));

  /* ------------------------------------------------------------ items */
  const ITEM_DEFS = [
    ['Sunset Harbor Cruise', 'tour', 120, 48, 5200, 1, [0,1,3], 0],
    ['Columbia Bar Jet Boat Run', 'tour', 90, 24, 8900, 2, [0,1,3], 1],
    ['Cape Lighthouse Hike', 'tour', 180, 16, 4500, 0, [0,1,4], 2],
    ['Half-Day Sea Kayak Tour', 'tour', 240, 12, 11500, 1, [0,1], 3],
    ['Whale Watching Expedition', 'tour', 210, 40, 9800, 1, [0,1,3], 0],
    ['Private Charter — 6 Guests', 'charter', 240, 6, 68000, 2, [0], 4],
    ['Kayak Rental — Full Day', 'rental', 480, 30, 6500, 0, [0], 3],
    ['E-Bike Rental — 4 Hours', 'rental', 240, 20, 4200, 0, [0], 3],
    ['Stand-Up Paddleboard Rental', 'rental', 180, 18, 3500, 0, [0], 3],
    ['Intro to Sea Kayaking Lesson', 'lesson', 150, 8, 8500, 1, [0,1], 3],
    ['Tide Pool Naturalist Walk', 'tour', 90, 20, 2800, 0, [0,1,3], 2],
    ['Maritime Museum Admission', 'ticket', 0, 200, 1800, 0, [0,1,3,4], 0],
    ['Lighthouse Night Photography', 'event', 180, 10, 12500, 2, [0,1], 2],
    ['Crabbing & Cook-Out', 'tour', 300, 18, 14500, 1, [0,1,3], 1],
  ];
  const items = ITEM_DEFS.map(([name, category, duration_minutes, capacity_default, basePrice, policyIdx, ctIdx, locIdx], i) => {
    const it = add('item', {
      pk: id('item'), company: CO, name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      category,
      status: i === 12 ? 'draft' : i === 11 && chance(.4) ? 'paused' : 'live',
      headline: {
        tour: 'Small groups, local guides, and the best light on the river.',
        rental: 'Grab your gear and go — helmets, vests and a route map included.',
        lesson: 'Coached from the beach out to open water. No experience needed.',
        ticket: 'Skip the line with a timed-entry ticket.',
        charter: 'The whole boat, your itinerary, our captain.',
        event: 'A limited-seat evening for a very specific kind of nerd.',
      }[category],
      description: 'Departs from the ticket office. Bring layers, closed-toe shoes and a water bottle. '
        + 'Restrooms and paid parking are on site. We run rain or shine; only lightning cancels a departure.',
      duration_minutes,
      capacity_default,
      min_party: category === 'charter' ? 4 : 1,
      max_party: category === 'charter' ? 6 : 12,
      location: locations[locIdx].pk,
      cancellation_policy: policies[policyIdx].pk,
      booking_cutoff_minutes: [0, 60, 120, 1440][int(0, 3)],
      requires_waiver: ['tour', 'rental', 'lesson', 'charter'].includes(category),
      online_booking: i !== 12,
      deposit_pct: category === 'charter' ? 0.25 : 0,
      image: '',
      sort_order: i,
      _basePrice: basePrice, _ctIdx: ctIdx,
    });
    return it;
  });
  const liveItems = items.filter(i => i.status === 'live');

  /* ------------------------------------------------------------ rates */
  const rates = [];
  const ratesByItem = {};
  for (const it of items) {
    ratesByItem[it.pk] = [];
    it._ctIdx.forEach((ci, n) => {
      const mult = [1, 0.62, 0, 0.85, 0.75, 0.5][ci];
      const price = ci === 2 ? 0 : Math.round(it._basePrice * mult / 100) * 100;
      const r = add('customer_type_rate', {
        pk: id('customer_type_rate'), item: it.pk, customer_type: ctypes[ci].pk,
        availability: null, total: price, cost: Math.round(price * 0.42),
        minimum_party_size: n === 0 ? 1 : 0, maximum_party_size: it.max_party, is_active: true,
      });
      rates.push(r); ratesByItem[it.pk].push(r);
    });
  }

  /* -------------------------------------------------------- schedules */
  const templates = [];
  for (const it of liveItems) {
    const timesByCat = {
      tour: [['09:00','17:30'], ['10:00','15:00'], ['08:30','14:30','17:00']][int(0,2)],
      rental: ['09:00'], lesson: ['09:30'], ticket: ['10:00'],
      charter: ['08:00'], event: ['20:00'],
    };
    const times = timesByCat[it.category];
    const dows = it.category === 'event' ? [5, 6] : it.category === 'charter' ? [4, 5, 6, 0] : [0,1,2,3,4,5,6];
    templates.push(add('availability_template', {
      pk: id('availability_template'), item: it.pk, name: `${it.name} — regular season`,
      start_date: addDays(T0, -200), end_date: addDays(T0, 150),
      days_of_week: dows, times, capacity: it.capacity_default, is_active: true,
    }));
  }

  /* --------------------------------------------------- availabilities */
  const WINDOW_BACK = 90, WINDOW_FWD = 75;
  const availabilities = [];
  const availByDate = {};
  for (const tpl of templates) {
    const it = items.find(i => i.pk === tpl.item);
    for (let d = -WINDOW_BACK; d <= WINDOW_FWD; d++) {
      const date = addDays(T0, d);
      const dow = new Date(date + 'T00:00:00').getDay();
      if (!tpl.days_of_week.includes(dow)) continue;
      // seasonality: fewer departures in the shoulder months
      const month = Number(date.slice(5, 7));
      const peak = month >= 5 && month <= 9;
      if (!peak && chance(.62)) continue;
      if (peak && chance(.18)) continue;
      for (const start_time of tpl.times) {
        if (!peak && chance(.5)) continue;
        const [H, M] = start_time.split(':').map(Number);
        const endM = H * 60 + M + (it.duration_minutes || 60);
        const cap = Math.max(2, tpl.capacity + int(-2, 2));
        const av = add('availability', {
          pk: id('availability'), item: it.pk, date, start_time,
          end_time: `${pad(Math.floor(endM / 60) % 24)}:${pad(endM % 60)}`,
          capacity: cap, booked: 0, headline: null,
          status: chance(.015) ? 'cancelled' : 'open',
          online_status: weighted([['bookable', 88], ['call_only', 8], ['closed', 4]]),
          template: tpl.pk,
          notes: chance(.06) ? pick(['Extra guide on this run.', 'Tide is low — use the north ramp.', 'Group hold until Friday.']) : '',
        });
        availabilities.push(av);
        (availByDate[date] ||= []).push(av);
      }
    }
  }

  /* --------------------------------------------------------- lodgings */
  const lodgings = ['Cannery Pier Hotel','Riverwalk Inn','Fort George B&B','Astoria Harbor Lodge','Seaside Suites','Columbia View Motel','Bayshore RV Park']
    .map((name, i) => add('lodging', {
      pk: id('lodging'), company: CO, name, address: `${100 + i * 37} Marine Dr, Astoria, OR`,
      pickup_offset_minutes: [-45, -30, -25, -40, -60, -35, -50][i], zone: i < 3 ? 'Downtown' : 'North Shore',
      is_active: i !== 6,
    }));

  /* --------------------------------------------------------- channels */
  const CH_DEFS = [
    ['Website — Lightframe', 'direct_online', 0, 46],
    ['Dashboard — phone/walk-in', 'dashboard', 0, 21],
    ['Front Desk Kiosk', 'kiosk', 0, 6],
    ['Point of Sale', 'pos', 0, 5],
    ['Affiliate / Concierge', 'affiliate', 0.18, 12],
    ['OTA Marketplace', 'ota', 0.22, 7],
    ['Partner API', 'api', 0.15, 3],
  ];
  const channels = CH_DEFS.map(([name, kind, commission_pct]) => add('channel', {
    pk: id('channel'), name, kind, commission_pct, is_active: true,
  }));
  const channelWeights = CH_DEFS.map((d, i) => [channels[i], d[3]]);

  /* ------------------------------------------------------- affiliates */
  const AFF_DEFS = [
    ['Coast Concierge Collective', 'concierge', 0.15],
    ['Pacific Tours Reseller', 'reseller', 0.20],
    ['GlobeSeek Marketplace', 'ota', 0.25],
    ['Riverwalk Inn Front Desk', 'concierge', 0.12],
    ['FareHarbor Distribution Network', 'network', 0.18],
    ['Northwest Adventure Co.', 'reseller', 0.18],
    ['Cruise Line Shore Excursions', 'reseller', 0.28],
  ];
  const affiliates = AFF_DEFS.map(([name, kind, commission_pct], i) => add('affiliate', {
    pk: id('affiliate'), company: CO, name, kind,
    contact_name: `${pick(FIRST)} ${pick(LAST)}`,
    email: `bookings@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`,
    phone: '503555' + String(2000 + i * 13).slice(0, 4),
    commission_pct,
    payment_terms: weighted([['net_of_commission', 5], ['invoice_monthly', 4], ['prepaid', 1]]),
    bookings_ytd: 0, revenue_ytd: 0, commission_owed: 0,
    status: i === 6 ? 'pending' : 'active',
  }));
  const activeAffiliates = affiliates.filter(a => a.status === 'active');

  /* --------------------------------------------------- taxes and fees */
  const taxes = [
    ['Oregon Transient Lodging Tax', 'tax', 'percent', 0.015, false],
    ['Harbor Access Fee', 'fee', 'flat_per_customer', 250, false],
    ['Booking Service Fee', 'fee', 'percent', 0.029, false],
    ['State Park Entry', 'fee', 'flat_per_booking', 500, true],
  ].map(([name, kind, calculation, rate, is_inclusive]) => add('tax_fee', {
    pk: id('tax_fee'), company: CO, name, kind, calculation, rate,
    applies_to: [], is_inclusive, is_active: true,
  }));

  /* ------------------------------------------------------ promo codes */
  const promos = [
    ['LOCALS20', 'percent', 20, -120, 240, 500],
    ['SPRINGFLING', 'percent', 15, -90, -20, 200],
    ['WELCOME10', 'percent', 10, -365, 365, 5000],
    ['CREWFAM', 'fixed', 2500, -365, 365, 100],
    ['SUNSET5', 'fixed', 500, -30, 60, 300],
  ].map(([code, kind, value, s, e, max_uses]) => add('promo_code', {
    pk: id('promo_code'), company: CO, code, kind, value,
    starts: addDays(T0, s), ends: addDays(T0, e), max_uses, used: 0,
    items: [], channels: [], is_active: addDays(T0, e) >= T0,
  }));

  /* ------------------------------------------------------- contacts */
  const contacts = [];
  for (let i = 0; i < 900; i++) {
    const first = pick(FIRST), last = pick(LAST);
    const [city, country] = pick(CITIES);
    contacts.push(add('contact', {
      pk: id('contact'), company: CO, name: `${first} ${last}`,
      email: `${first}.${last}${int(1, 99)}`.toLowerCase() + '@' + pick(DOMAINS),
      phone: `${int(200,989)}555${String(int(1000,9999))}`,
      country, city,
      marketing_opt_in: chance(.62),
      booking_count: 0, lifetime_value: 0,
      first_booked: null, last_booked: null,
      tags: shuffle(['repeat','vip','group-leader','local','review-left','photographer']).slice(0, int(0, 2)),
      notes: chance(.12) ? pick(['Prefers the earliest departure.','Allergic to shellfish — no cook-out.','Travels with a service dog.','Corporate group organiser.']) : '',
    }));
  }

  /* ------------------------------------------------------- bookings */
  const bookings = [], bcustomers = [], payments = [], cfValues = [], notes = [], checkins = [], waiverSigs = [];
  const bookingsByAvail = {};
  let bookingSeq = 41200;

  const orderedAvail = shuffle(availabilities.filter(a => a.status !== 'cancelled'));
  for (const av of orderedAvail) {
    const it = items.find(i => i.pk === av.item);
    const daysOut = Math.round((new Date(av.date) - new Date(T0)) / 86400000);
    // demand curve: past dates fill up, far-future dates are sparse
    const fillTarget = daysOut < 0 ? 0.45 + R() * 0.5
      : daysOut < 14 ? 0.35 + R() * 0.5
      : daysOut < 45 ? 0.15 + R() * 0.4
      : R() * 0.25;
    if (chance(.34)) continue;                 // plenty of departures sell nothing
    let seatsLeft = Math.round(av.capacity * Math.min(1, fillTarget));
    let guard = 0;
    while (seatsLeft > 0 && guard++ < 3) {
      const share = Math.ceil(seatsLeft / (4 - guard));
      const partyMax = Math.max(1, Math.min(seatsLeft, it.max_party, share));
      const pax = int(1, partyMax);
      const contact = pick(contacts);
      const channel = weighted(channelWeights);
      const isAffiliate = ['affiliate', 'ota', 'api'].includes(channel.kind);
      const affiliate = isAffiliate ? pick(activeAffiliates) : null;
      // realistic lead time: most guests book within a few weeks of departure
      const lead = weighted([[int(0, 3), 30], [int(3, 10), 30], [int(10, 30), 25], [int(30, 90), 15]]);
      let bookedAt = daysOut - lead;
      if (bookedAt > 0) bookedAt = -int(0, 21);              // far-future trip booked recently
      if (bookedAt < -WINDOW_BACK) bookedAt = -int(1, WINDOW_BACK);
      const code = `FH-${bookingSeq++}`;

      // seats: mix of customer types available on this item
      const itemRates = ratesByItem[it.pk];
      const seats = [];
      let remaining = pax;
      for (let s = 0; s < pax; s++) {
        const r = s === 0 ? itemRates[0] : pick(itemRates);
        seats.push(r);
      }
      const subtotal = seats.reduce((s, r) => s + r.total, 0);
      if (subtotal === 0) { seatsLeft -= pax; continue; }

      // discount
      let discount_total = 0, promo = null;
      if (chance(.13)) {
        promo = pick(promos);
        discount_total = promo.kind === 'percent'
          ? Math.round(subtotal * promo.value / 100)
          : Math.min(subtotal, promo.value);
        promo.used++;
      }
      const taxable = subtotal - discount_total;
      const tax_total = Math.round(taxable * 0.044) + 250 * pax;
      const total = taxable + tax_total;

      // status
      const status = daysOut < 0
        ? weighted([['completed', 88], ['cancelled', 6], ['no_show', 6]])
        : weighted([['confirmed', 93], ['pending', 4], ['cancelled', 3]]);
      const cancelled = status === 'cancelled';

      // payment
      const payMethod = channel.kind === 'pos' ? weighted([['terminal', 6], ['cash', 3], ['card', 1]])
        : channel.kind === 'dashboard' ? weighted([['card', 7], ['cash', 2], ['invoice', 1]])
        : affiliate && affiliate.payment_terms === 'invoice_monthly' ? 'invoice'
        : weighted([['card', 8], ['apple_pay', 2], ['gift_card', 1]]);
      const depositOnly = it.deposit_pct > 0 && chance(.5);
      let paid = cancelled ? 0 : depositOnly ? Math.round(total * it.deposit_pct)
        : payMethod === 'invoice' && chance(.4) ? 0 : total;

      const booking = add('booking', {
        pk: id('booking'), code, company: CO, item: it.pk, availability: av.pk,
        contact: contact.pk, status, channel: channel.pk,
        affiliate: affiliate ? affiliate.pk : null,
        pax, subtotal, tax_total, discount_total, total,
        paid, balance: total - paid,
        created_at: dtOffset(bookedAt),
        created_by: ['dashboard', 'pos', 'kiosk'].includes(channel.kind) ? pick(staff).pk : null,
        promo_code: promo ? promo.pk : null,
        lodging: chance(.22) ? pick(lodgings).pk : null,
        is_checked_in: false,
        waiver_status: !it.requires_waiver ? 'not_required' : 'pending',
        source_url: channel.kind === 'direct_online' ? 'https://harborline.example/tours/' + it.slug : '',
      });
      bookings.push(booking);
      (bookingsByAvail[av.pk] ||= []).push(booking);

      // seats -> booking_customers
      const bcs = seats.map((r, n) => {
        const nm = n === 0 ? contact.name : `${pick(FIRST)} ${last(contact.name)}`;
        return add('booking_customer', {
          pk: id('booking_customer'), booking: booking.pk, customer_type_rate: r.pk,
          name: nm,
          email: n === 0 ? contact.email : '',
          phone: n === 0 ? contact.phone : '',
          price: r.total, checked_in_at: null, waiver_signed: false,
        });
      });
      bcustomers.push(...bcs);

      // payments
      if (paid > 0) {
        const fee = Math.round(paid * 0.029) + 30;
        payments.push(add('payment', {
          pk: id('payment'), booking: booking.pk, kind: 'charge', method: payMethod,
          amount: paid, fee: ['cash', 'check', 'invoice'].includes(payMethod) ? 0 : fee,
          net: paid - (['cash', 'check', 'invoice'].includes(payMethod) ? 0 : fee),
          status: 'succeeded',
          card_brand: ['card', 'apple_pay', 'terminal'].includes(payMethod) ? pick(['Visa','Mastercard','Amex','Discover']) : '',
          card_last4: ['card', 'apple_pay', 'terminal'].includes(payMethod) ? String(int(1000, 9999)) : '',
          processor_ref: 'ch_' + Math.floor(R() * 1e12).toString(36),
          created_at: booking.created_at, payout: null,
          created_by: booking.created_by,
        }));
      }
      if (cancelled && chance(.7)) {
        const refundAmt = Math.round(total * pick([1, 1, 0.5]));
        payments.push(add('payment', {
          pk: id('payment'), booking: booking.pk, kind: 'refund', method: payMethod,
          amount: -refundAmt, fee: 0, net: -refundAmt, status: 'succeeded',
          card_brand: '', card_last4: '', processor_ref: 're_' + Math.floor(R() * 1e12).toString(36),
          created_at: dtOffset(Math.min(-1, bookedAt + int(1, 10))), payout: null,
          created_by: pick(staff).pk,
        }));
      }
      if (chance(.004)) {
        payments.push(add('payment', {
          pk: id('payment'), booking: booking.pk, kind: 'chargeback', method: 'card',
          amount: -total, fee: 1500, net: -total - 1500, status: 'disputed',
          card_brand: 'Visa', card_last4: String(int(1000, 9999)),
          processor_ref: 'dp_' + Math.floor(R() * 1e12).toString(36),
          created_at: dtOffset(Math.min(-1, bookedAt + 20)), payout: null, created_by: null,
        }));
      }

      // waivers, check-in, notes
      if (it.requires_waiver && !cancelled) {
        const signedCount = weighted([[bcs.length, 6], [Math.max(0, bcs.length - 1), 2], [0, 2]]);
        bcs.slice(0, signedCount).forEach(bc => { bc.waiver_signed = true; });
        booking.waiver_status = signedCount === bcs.length ? 'signed' : signedCount === 0 ? 'pending' : 'partial';
      }
      if (daysOut <= 0 && status === 'completed') {
        booking.is_checked_in = true;
        const at = `${av.date}T${av.start_time}:00`;
        bcs.forEach(bc => { bc.checked_in_at = at; });
        checkins.push(add('checkin', {
          pk: id('checkin'), booking: booking.pk, availability: av.pk,
          checked_in_count: bcs.length, total_count: bcs.length, checked_in_at: at,
          by_user: pick(staff).pk, device: weighted([['mobile_app', 5], ['dashboard', 3], ['kiosk', 1], ['scanner', 1]]),
        }));
      }
      if (chance(.09)) {
        notes.push(add('note', {
          pk: id('note'), target_type: 'booking', target: booking.pk,
          visibility: weighted([['internal', 6], ['manifest', 3], ['guest_visible', 1]]),
          body: pick([
            'Guest called to confirm parking. Told them lot B.',
            'Celebrating an anniversary — seat them at the bow.',
            'One guest is vegetarian; galley notified.',
            'Arriving on the 2:10 ferry, may be five minutes late.',
            'Requested a quieter group. Moved from the 5:30.',
            'Balance to be settled at check-in, card on file declined once.',
          ]),
          author: pick(staff).pk, created_at: booking.created_at,
        }));
      }

      // roll up contact + affiliate stats
      contact.booking_count++;
      if (!cancelled) contact.lifetime_value += total;
      const bookedDate = booking.created_at.slice(0, 10);
      if (!contact.first_booked || bookedDate < contact.first_booked) contact.first_booked = bookedDate;
      if (!contact.last_booked || bookedDate > contact.last_booked) contact.last_booked = bookedDate;
      if (affiliate && !cancelled) {
        affiliate.bookings_ytd++;
        affiliate.revenue_ytd += total;
        affiliate.commission_owed += Math.round(total * affiliate.commission_pct);
      }
      if (!cancelled) av.booked += pax;
      seatsLeft -= pax;
    }
    if (av.booked >= av.capacity) av.status = 'sold_out';
  }

  function last(fullName) { return String(fullName).split(' ').slice(-1)[0]; }

  /* ---------------------------------------------- custom field values */
  const customFields = [
    ['Any dietary restrictions?', 'short_text', 'booking', [], false, true],
    ['Shirt size', 'select', 'customer', ['XS','S','M','L','XL','2XL'], false, true],
    ['Height (cm)', 'number', 'customer', [], true, true],
    ['Emergency contact & phone', 'short_text', 'booking', [], true, true],
    ['Have you paddled before?', 'select', 'customer', ['Never','A little','Confident','Instructor'], false, true],
    ['How did you hear about us?', 'select', 'booking', ['Search','Instagram','Friend','Hotel concierge','Walked past','Returning guest'], false, false],
    ['I understand the cancellation policy', 'checkbox', 'booking', [], true, false],
    ['Vehicle licence plate', 'short_text', 'booking', [], false, true],
  ].map(([title, type, level, options, is_required, show_on_manifest]) => add('custom_field', {
    pk: id('custom_field'), company: CO, title, type, level, options, is_required, show_on_manifest,
    items: [], description: '',
  }));

  const CF_ANSWERS = {
    'Any dietary restrictions?': ['None','Vegetarian','Gluten free','Shellfish allergy','Vegan','Nut allergy'],
    'Shirt size': ['XS','S','M','L','XL','2XL'],
    'Height (cm)': ['158','163','170','175','180','185','191'],
    'Emergency contact & phone': ['Sam Rivera 503-555-0114','Jo Tanaka 971-555-0182','Alex Byrne 360-555-0155'],
    'Have you paddled before?': ['Never','A little','Confident','Instructor'],
    'How did you hear about us?': ['Search','Instagram','Friend','Hotel concierge','Walked past','Returning guest'],
    'I understand the cancellation policy': ['Yes'],
    'Vehicle licence plate': ['ORC 4471','WAH 8820','CA 7XKD221'],
  };
  for (const b of bookings) {
    if (!chance(.55)) continue;
    for (const cf of customFields) {
      if (!chance(.4)) continue;
      if (cf.level === 'booking') {
        cfValues.push(add('custom_field_value', {
          pk: id('custom_field_value'), custom_field: cf.pk, booking: b.pk,
          booking_customer: null, value: pick(CF_ANSWERS[cf.title]),
        }));
      }
    }
  }
  for (const bc of bcustomers) {
    if (!chance(.35)) continue;
    const cf = pick(customFields.filter(c => c.level === 'customer'));
    cfValues.push(add('custom_field_value', {
      pk: id('custom_field_value'), custom_field: cf.pk, booking: bc.booking,
      booking_customer: bc.pk, value: pick(CF_ANSWERS[cf.title]),
    }));
  }

  /* --------------------------------------------------------- waivers */
  const waiverTemplates = [
    ['Standard Liability Waiver & Release', 'v4.2', 'guardian_signs'],
    ['Powered Vessel Acknowledgement', 'v2.0', 'guardian_signs'],
    ['Minor Participation Consent', 'v1.3', 'separate_waiver'],
  ].map(([name, version, minor_policy]) => add('waiver_template', {
    pk: id('waiver_template'), company: CO, name, version, minor_policy,
    body: 'I acknowledge that participation in guided water and trail activities involves inherent risks, '
      + 'including but not limited to changing weather, cold water immersion, uneven terrain and vessel motion. '
      + 'I confirm that I am in adequate health to participate and will follow all crew instructions.',
    items: [], is_active: true,
  }));
  for (const bc of bcustomers) {
    if (!bc.waiver_signed) continue;
    const b = bookings.find(x => x.pk === bc.booking);
    if (!b) continue;
    const isMinor = chance(.12);
    waiverSigs.push(add('waiver_signature', {
      pk: id('waiver_signature'), template: waiverTemplates[0].pk, booking: b.pk,
      booking_customer: bc.pk, signer_name: isMinor ? `${pick(FIRST)} ${last(bc.name)}` : bc.name,
      signed_at: b.created_at, ip_address: `${int(24,203)}.${int(0,255)}.${int(0,255)}.${int(1,254)}`,
      is_minor: isMinor, guardian_name: isMinor ? `${pick(FIRST)} ${last(bc.name)}` : '',
    }));
  }

  /* --------------------------------------------------------- payouts */
  const chargePayments = payments.filter(p => p.created_at.slice(0, 10) < T0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const payouts = [];
  for (let w = 17; w >= 0; w--) {
    const period_start = addDays(T0, -(w + 1) * 7);
    const period_end = addDays(T0, -w * 7 - 1);
    const inWindow = chargePayments.filter(p => {
      const d = p.created_at.slice(0, 10);
      return d >= period_start && d <= period_end && p.method !== 'invoice';
    });
    if (!inWindow.length) continue;
    const gross = inWindow.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0);
    const refunds = inWindow.filter(p => p.amount < 0).reduce((s, p) => s + p.amount, 0);
    const fees = inWindow.reduce((s, p) => s + p.fee, 0);
    const adjustments = chance(.15) ? -int(500, 4000) : 0;
    const po = add('payout', {
      pk: id('payout'), company: CO, reference: `PO-${period_end.replace(/-/g, '')}`,
      period_start, period_end, gross, refunds, fees, adjustments,
      net: gross + refunds - fees + adjustments,
      status: w === 0 ? 'in_transit' : w === 1 && chance(.3) ? 'scheduled' : 'paid',
      paid_on: w === 0 ? null : addDays(period_end, 3),
      bank_last4: '4417', transaction_count: inWindow.length,
    });
    inWindow.forEach(p => { p.payout = po.pk; });
    payouts.push(po);
  }

  /* ------------------------------------------------------- resources */
  const RES_DEFS = [
    ['MV Harbor Light', 'vessel', 48, 1], ['MV Bar Runner', 'vessel', 24, 1],
    ['Zodiac Alpha', 'vessel', 12, 4], ['Zodiac Bravo', 'vessel', 12, 4],
    ['Van 1 — 14 seat', 'vehicle', 14, 0], ['Van 2 — 14 seat', 'vehicle', 14, 0],
    ['Kayak Fleet A (12)', 'equipment', 12, 3], ['Kayak Fleet B (12)', 'equipment', 12, 3],
    ['E-Bike Fleet (20)', 'equipment', 20, 3], ['SUP Fleet (18)', 'equipment', 18, 3],
    ['Classroom — Pier 12', 'room', 20, 0],
  ];
  const resources = RES_DEFS.map(([name, kind, capacity, locIdx], i) => add('resource', {
    pk: id('resource'), company: CO, name, kind, capacity, location: locations[locIdx].pk,
    status: i === 3 ? 'maintenance' : 'available',
    notes: i === 3 ? 'Outboard service booked — back in the water Thursday.' : '',
  }));
  const guides = staff.filter(u => roles.find(r => r.pk === u.role)?.name === 'Guide');
  guides.forEach(g => resources.push(add('resource', {
    pk: id('resource'), company: CO, name: g.name, kind: 'staff', capacity: 1,
    location: locations[0].pk, status: 'available', notes: 'Certified: swiftwater rescue, WFR.',
  })));

  const soonAvail = availabilities.filter(a => a.date >= addDays(T0, -7) && a.date <= addDays(T0, 21) && a.booked > 0);
  for (const av of soonAvail) {
    const it = items.find(i => i.pk === av.item);
    const pool = resources.filter(r => r.kind !== 'staff' && r.capacity >= Math.min(av.capacity, 12)
      && (it.category === 'rental' ? r.kind === 'equipment' : true));
    if (pool.length && chance(.8)) {
      add('resource_assignment', {
        pk: id('resource_assignment'), resource: pick(pool).pk, availability: av.pk,
        role: it.category === 'rental' ? 'Fleet' : 'Primary craft',
        status: weighted([['assigned', 8], ['tentative', 2]]),
      });
    }
    if (guides.length && it.category !== 'rental' && chance(.75)) {
      const g = pick(resources.filter(r => r.kind === 'staff'));
      add('resource_assignment', {
        pk: id('resource_assignment'), resource: g.pk, availability: av.pk,
        role: 'Lead guide', status: 'assigned',
      });
    }
  }

  /* ------------------------------------------------------- gift cards */
  for (let i = 0; i < 140; i++) {
    const initial = pick([2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000]);
    const spent = chance(.45) ? Math.round(initial * (0.2 + R() * 0.8) / 100) * 100 : 0;
    const balance = Math.max(0, initial - spent);
    const issued = addDays(T0, -int(1, 700));
    const p = pick(contacts);
    add('gift_card', {
      pk: id('gift_card'), company: CO,
      code: 'GC-' + Math.floor(R() * 1e9).toString(36).toUpperCase().padStart(6, 'X').slice(0, 6),
      initial_value: initial, balance,
      purchaser_name: p.name, purchaser_email: p.email,
      recipient_name: `${pick(FIRST)} ${pick(LAST)}`,
      issued_on: issued, expires_on: addDays(issued, 730),
      status: balance === 0 ? 'redeemed' : addDays(issued, 730) < T0 ? 'expired' : chance(.02) ? 'void' : 'active',
    });
  }

  /* ------------------------------------------------------ memberships */
  const memberTypes = [
    ['Harbor Club — Annual', 12000, 'annual', 'percent_off', 15],
    ['Paddle Pass — 10 Visits', 45000, 'one_time', 'free_visits', 10],
    ['Museum Friends — Monthly', 900, 'monthly', 'unlimited', 0],
  ].map(([name, price, billing, benefit, benefit_value]) => add('membership_type', {
    pk: id('membership_type'), company: CO, name, price, billing, benefit, benefit_value,
    items: [], member_count: 0, is_active: true,
  }));
  for (let i = 0; i < 180; i++) {
    const mt = weighted([[memberTypes[0], 5], [memberTypes[1], 3], [memberTypes[2], 4]]);
    const started = addDays(T0, -int(5, 500));
    const status = weighted([['active', 7], ['lapsed', 2], ['past_due', 1], ['cancelled', 1]]);
    mt.member_count++;
    add('membership', {
      pk: id('membership'), membership_type: mt.pk, contact: pick(contacts).pk,
      started_on: started,
      renews_on: mt.billing === 'monthly' ? addDays(T0, int(1, 30)) : addDays(started, 365),
      visits_used: mt.benefit === 'free_visits' ? int(0, 10) : int(0, 22),
      status,
    });
  }

  /* ------------------------------------------------ message templates */
  const msgTemplates = [
    ['Booking confirmation', 'booking_confirmed', 'email', 'Your {{item_name}} is confirmed — {{date}}', 0],
    ['Reminder — 48 hours out', 'reminder_48h', 'email', 'See you soon: {{item_name}} on {{date}}', -48],
    ['Reminder — day before (SMS)', 'reminder_24h', 'sms', '', -24],
    ['Waiver still needed', 'waiver_request', 'email', 'Action needed: sign your waiver before {{date}}', -72],
    ['Balance due', 'balance_due', 'email', 'A balance of {{balance}} is outstanding', -96],
    ['Cancellation confirmed', 'cancelled', 'email', 'Your booking {{code}} has been cancelled', 0],
    ['How was your trip?', 'post_trip', 'email', 'Thanks for paddling with us', 24],
  ].map(([name, trigger, medium, subject, offset_hours]) => add('message_template', {
    pk: id('message_template'), company: CO, name, trigger, medium, subject,
    body: 'Hi {{first_name}},\n\nYour booking {{code}} for {{item_name}} on {{date}} at {{time}} is all set. '
      + 'Please arrive 20 minutes early at {{meeting_point}}.\n\n{{company_name}}',
    offset_hours, is_active: !(trigger === 'post_trip' && chance(.4)),
  }));
  const recentBookings = bookings.filter(b => b.created_at.slice(0, 10) >= addDays(T0, -45));
  for (const b of shuffle(recentBookings).slice(0, 700)) {
    const contact = contacts.find(c => c.pk === b.contact);
    const tpl = pick(msgTemplates);
    add('message_log', {
      pk: id('message_log'), template: tpl.pk, booking: b.pk,
      to: tpl.medium === 'sms' ? contact.phone : contact.email,
      medium: tpl.medium, subject: tpl.subject,
      status: weighted([['delivered', 6], ['opened', 5], ['sent', 2], ['bounced', 1], ['failed', 1]]),
      sent_at: b.created_at,
    });
  }

  /* --------------------------------------------------------- widgets */
  const WIDGET_DEFS = [
    ['Homepage “Book Now”', 'button', 'lightframe', 'Site header, every page'],
    ['Tour page calendar', 'inline_calendar', 'inline', 'Each item detail page'],
    ['All-tours list', 'item_list', 'lightframe', '/tours landing page'],
    ['Gift card popup', 'popup', 'lightframe', 'Exit intent, seasonal'],
    ['Concierge full-page flow', 'full_page', 'new_tab', 'Hotel partner iPads'],
    ['Instagram bio link', 'full_page', 'new_tab', 'Social profile'],
  ];
  WIDGET_DEFS.forEach(([name, kind, flow, placement], i) => add('widget', {
    pk: id('widget'), company: CO, name, kind,
    item: kind === 'inline_calendar' ? liveItems[i % liveItems.length].pk : null,
    flow, theme_color: '#0b7bc1', placement,
    views_30d: int(400, 24000), bookings_30d: int(5, 380),
    is_active: i !== 5,
  }));

  /* --------------------------------------------- marketplace listings */
  ['Google Things to Do', 'GlobeSeek', 'Coastal Getaways', 'TripBoard'].forEach(marketplace => {
    for (const it of shuffle(liveItems).slice(0, int(3, 6))) {
      add('external_listing', {
        pk: id('external_listing'), company: CO, marketplace, item: it.pk,
        external_id: marketplace.slice(0, 2).toUpperCase() + '-' + int(100000, 999999),
        sync_status: weighted([['live', 8], ['syncing', 1], ['error', 1], ['paused', 1]]),
        last_sync: dtOffset(-int(0, 3)),
        last_error: chance(.15) ? 'Price mismatch: child rate missing on external listing' : '',
        bookings_30d: int(0, 60),
      });
    }
  });

  /* ------------------------------------------------------------ tasks */
  const unpaid = bookings.filter(b => b.balance > 0 && b.status !== 'cancelled');
  for (const b of shuffle(unpaid).slice(0, 18)) {
    add('task', {
      pk: id('task'), company: CO, title: `Collect ${(b.balance / 100).toFixed(2)} balance on ${b.code}`,
      kind: 'balance_due', booking: b.pk, assignee: pick(staff).pk,
      due_date: addDays(T0, int(-5, 10)), priority: weighted([['high', 3], ['normal', 5], ['urgent', 1]]),
      status: weighted([['open', 6], ['in_progress', 2], ['done', 2]]),
    });
  }
  const missingWaivers = bookings.filter(b => b.waiver_status === 'pending' && b.status === 'confirmed');
  for (const b of shuffle(missingWaivers).slice(0, 14)) {
    add('task', {
      pk: id('task'), company: CO, title: `Chase waiver for ${b.code}`, kind: 'waiver_missing',
      booking: b.pk, assignee: pick(staff).pk, due_date: addDays(T0, int(0, 6)),
      priority: 'normal', status: weighted([['open', 7], ['done', 3]]),
    });
  }
  [
    ['Zodiac Bravo — replace impeller', 'maintenance', 'high'],
    ['Reply to 3-star review from last Saturday', 'review', 'normal'],
    ['Call Riverwalk Inn about Q3 commission rate', 'callback', 'normal'],
    ['Re-photograph the kayak fleet for the item page', 'other', 'low'],
    ['Renew Oregon marine operator permit', 'other', 'urgent'],
  ].forEach(([title, kind, priority]) => add('task', {
    pk: id('task'), company: CO, title, kind, booking: null, assignee: pick(staff).pk,
    due_date: addDays(T0, int(-3, 20)), priority, status: weighted([['open', 7], ['in_progress', 3]]),
  }));

  /* --------------------------------------------------------- API keys */
  [['Partner integration — GlobeSeek', ['bookings:read','availability:read']],
   ['Internal BI warehouse sync', ['bookings:read','payments:read','items:read']],
   ['Kiosk app', ['bookings:write','availability:read']],
   ['Legacy website (revoked)', ['bookings:read']]].forEach(([name, scopes], i) => add('api_key', {
    pk: id('api_key'), company: CO, name,
    key_prefix: 'fh_live_' + Math.floor(R() * 1e10).toString(36).slice(0, 8),
    scopes, created_at: dtOffset(-int(60, 700)), last_used: dtOffset(-int(0, 5)),
    requests_30d: int(200, 180000), status: i === 3 ? 'revoked' : 'active',
  }));

  [['https://ops.harborline.example/hooks/fh', ['booking.created','booking.cancelled','booking.updated'], 'active', 0.998],
   ['https://hooks.zapier.example/hooks/catch/8812/abc', ['booking.created'], 'active', 1],
   ['https://warehouse.harborline.example/ingest', ['payment.succeeded','payout.paid'], 'failing', 0.61]]
    .forEach(([url, events, status, success_rate]) => add('webhook', {
      pk: id('webhook'), company: CO, url, events, status, success_rate,
      last_delivery: dtOffset(0), failures_24h: status === 'failing' ? int(20, 90) : 0,
    }));

  /* ----------------------------------------------------- activity log */
  const ACTIONS = [
    ['booking.created', 'booking', 'created a booking'],
    ['booking.cancelled', 'booking', 'cancelled a booking'],
    ['payment.refunded', 'payment', 'issued a refund'],
    ['item.updated', 'item', 'changed pricing'],
    ['availability.created', 'availability', 'added departures'],
    ['user.invited', 'user', 'invited a teammate'],
    ['settings.updated', 'company', 'changed cancellation policy'],
    ['payout.viewed', 'payout', 'exported a payout report'],
    ['contact.merged', 'contact', 'merged duplicate contacts'],
  ];
  for (let i = 0; i < 260; i++) {
    const [action, target_type, detail] = pick(ACTIONS);
    add('activity_log', {
      pk: id('activity_log'), company: CO, actor: pick(staff).pk, action, target_type,
      target: target_type === 'booking' ? pick(bookings).code : '—',
      detail, created_at: dtOffset(-int(0, 30)),
      ip_address: `${int(24,203)}.${int(0,255)}.${int(0,255)}.${int(1,254)}`,
    });
  }

  /* --------------------------------------------------- saved reports */
  [['Daily sales by item', 'bookings', 'item', 'daily'],
   ['Weekly channel mix', 'bookings', 'channel', 'weekly'],
   ['Outstanding balances', 'bookings', null, 'daily'],
   ['Affiliate commission — monthly', 'bookings', 'affiliate', 'monthly'],
   ['Payout reconciliation', 'payouts', null, 'weekly'],
   ['Capacity utilisation', 'availability', 'item', 'none']]
    .forEach(([name, base, group_by, schedule]) => add('saved_report', {
      pk: id('saved_report'), company: CO, name, base,
      columns: [], filters: {}, group_by, schedule,
      recipients: schedule === 'none' ? [] : [pick(staff).email], owner: pick(staff).pk,
    }));

  /* ---------------------------------------------------------- cleanup */
  items.forEach(i => { delete i._basePrice; delete i._ctIdx; });
  return out;
}
