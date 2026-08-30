import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, toggle, sidenav, checkbox, codeBlock } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

const SECTIONS = [
  { label: 'Company', items: [
    { id: 'company', title: 'Company profile' },
    { id: 'locations', title: 'Locations' },
    { id: 'hours', title: 'Hours & seasons' },
  ] },
  { label: 'Selling', items: [
    { id: 'policies', title: 'Cancellation policies' },
    { id: 'lodgings', title: 'Lodgings & pickups' },
    { id: 'checkout', title: 'Checkout options' },
  ] },
  { label: 'Money', items: [
    { id: 'payments', title: 'Payment settings' },
    { id: 'taxes', title: 'Taxes & fees' },
  ] },
  { label: 'Platform', items: [
    { id: 'notifications', title: 'Internal notifications' },
    { id: 'data', title: 'Data & retention' },
  ] },
];

export default {
  id: 'settings',
  title: 'Settings',
  icon: '⚙',
  group: 'Admin',
  order: 230,
  summary: 'Company profile, locations, policies, lodgings, taxes and the rest of the configuration surface.',
  entities: ['company', 'location', 'cancellation_policy', 'lodging', 'tax_fee'],

  commands: (ctx) => SECTIONS.flatMap(s => s.items).map(i => ({ title: `Settings — ${i.title}`, path: `/settings?section=${i.id}` })),

  render(ctx) {
    const { db, router, route, store } = ctx;
    const section = route.query.section || 'company';
    const co = ctx.domain.company();
    const set = (patch) => db.update('company', co.pk, patch);

    const panes = {
      company: () => card({ title: 'Company profile', sub: 'Appears on confirmations, waivers and receipts' },
        h('div.grid.c2',
          f('Company name', h('input.input', { value: co.name, onchange: e => set({ name: e.target.value }) })),
          f('Shortname', h('input.input', { value: co.shortname, onchange: e => set({ shortname: e.target.value }) }),
            `Your booking URL: fareharbor.com/${co.shortname}/`),
          f('Support email', h('input.input', { value: co.email, onchange: e => set({ email: e.target.value }) })),
          f('Support phone', h('input.input', { value: co.phone, onchange: e => set({ phone: e.target.value }) })),
          f('Website', h('input.input', { value: co.website, onchange: e => set({ website: e.target.value }) })),
          f('Timezone', select(['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Pacific/Honolulu', 'Europe/London', 'Australia/Sydney'], co.timezone, v => set({ timezone: v })),
            'Every date and time in the dashboard is rendered in this zone.'),
          f('Currency', select(['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD'], co.currency, v => set({ currency: v }))),
          f('Brand colour', h('input.input', { type: 'color', value: co.logo_color, onchange: e => set({ logo_color: e.target.value }) })),
          f('Address', h('textarea.textarea', { value: co.address, onchange: e => set({ address: e.target.value }) }), null, true))),

      locations: () => card({ title: 'Locations', sub: 'Offices, docks, trailheads and shops', flush: true,
        actions: [btn('Add location', { size: 'sm', kind: 'primary', onclick: () => editLocation(ctx, null) })] },
        simpleTable(['Name', 'Kind', 'Address', { label: 'Items meeting here', align: 'num' }, 'Active', ''],
          db.all('location').map(l => [
            h('span.strong', l.name), badge(F.titleCase(l.kind)),
            h('span.small.muted', l.address),
            db.where('item', i => i.location === l.pk).length,
            toggle(l.is_active, v => db.update('location', l.pk, { is_active: v })),
            btn('Edit', { size: 'sm', onclick: () => editLocation(ctx, l) }),
          ]))),

      hours: () => h('div.col',
        card({ title: 'Operating hours', sub: 'When the ticket office answers the phone' },
          simpleTable(['Day', 'Opens', 'Closes', 'Open'],
            [0, 1, 2, 3, 4, 5, 6].map(d => [
              F.dowName(d),
              h('input.input', { type: 'time', value: d === 0 ? '08:00' : '07:30', style: 'width:130px' }),
              h('input.input', { type: 'time', value: d === 0 ? '18:00' : '19:00', style: 'width:130px' }),
              toggle(true, () => {}),
            ]))),
        card({ title: 'Season' },
          h('div.grid.c2',
            f('Season starts', h('input.input', { type: 'date', value: F.today().slice(0, 4) + '-04-01' })),
            f('Season ends', h('input.input', { type: 'date', value: F.today().slice(0, 4) + '-10-31' }))),
          h('p.small.muted.mt-3', 'Outside the season, online booking is closed and the calendar shows no departures unless a schedule explicitly covers those dates.'))),

      policies: () => card({ title: 'Cancellation policies', sub: 'Attached per item; drives the refund calculator', flush: true,
        actions: [btn('Add policy', { size: 'sm', kind: 'primary', onclick: () => editPolicy(ctx, null) })] },
        simpleTable(['Policy', { label: 'Free-cancel window', align: 'num' }, { label: 'Refund after cutoff', align: 'num' }, 'Guest-facing text', { label: 'Items', align: 'num' }, ''],
          db.all('cancellation_policy').map(p => [
            h('span.strong', p.name),
            `${p.cutoff_hours}h before`,
            F.pct(p.refund_pct, 0),
            h('span.small.muted', F.truncate(p.description, 70)),
            db.where('item', i => i.cancellation_policy === p.pk).length,
            btn('Edit', { size: 'sm', onclick: () => editPolicy(ctx, p) }),
          ]))),

      lodgings: () => card({ title: 'Lodgings & pickup points', sub: 'Hotels a guest can pick at checkout, with their pickup offsets', flush: true,
        actions: [btn('Add lodging', { size: 'sm', kind: 'primary', onclick: () => editLodging(ctx, null) })] },
        simpleTable(['Lodging', 'Address', 'Zone', { label: 'Pickup offset', align: 'num' }, { label: 'Bookings', align: 'num' }, 'Active', ''],
          db.all('lodging').map(l => [
            h('span.strong', l.name), h('span.small.muted', l.address), l.zone,
            `${Math.abs(l.pickup_offset_minutes)} min before`,
            db.where('booking', b => b.lodging === l.pk).length,
            toggle(l.is_active, v => db.update('lodging', l.pk, { is_active: v })),
            btn('Edit', { size: 'sm', onclick: () => editLodging(ctx, l) }),
          ]))),

      checkout: () => card({ title: 'Checkout options' },
        h('div.col', { style: { gap: '16px' } },
          sw('Collect a name for every guest', 'Otherwise only the lead guest is named.', true),
          sw('Require a phone number', 'Useful when you routinely call about weather.', true),
          sw('Show the cancellation policy before payment', 'Reduces disputes.', true),
          sw('Allow guests to add a gratuity', 'Appears as a separate line on the booking.', false),
          sw('Offer gift-card redemption at checkout', '', true),
          sw('Offer promo codes at checkout', 'Turn off to make codes phone-only.', true),
          sw('Ask how the guest heard about you', 'Populates the attribution custom field.', true),
          sw('Send an SMS reminder the day before', 'Requires a phone number.', true))),

      payments: () => h('div.col',
        card({ title: 'Processing' }, h('div.grid.c2',
          f('Processor', h('input.input', { value: 'FareHarbor Payments', disabled: true })),
          f('Card rate', h('input.input', { value: '2.9% + $0.30', disabled: true })),
          f('Payout schedule', select([['weekly', 'Weekly (Mondays)'], ['daily', 'Daily'], ['monthly', 'Monthly']], 'weekly', () => {})),
          f('Bank account', h('input.input', { value: '····4417', disabled: true })),
          f('Statement descriptor', h('input.input', { value: 'HARBORLINE ADV' })),
          f('Hold period', select([['3', '3 business days'], ['1', 'Next business day'], ['7', '7 days']], '3', () => {})))),
        card({ title: 'Accepted methods' },
          h('div.col', { style: { gap: '14px' } },
            sw('Credit and debit cards', 'Visa, Mastercard, Amex, Discover', true),
            sw('Apple Pay & Google Pay', 'Shown automatically on supported devices', true),
            sw('Card terminals at the desk', '2 readers paired', true),
            sw('Cash', 'Recorded in the dashboard; not settled by FareHarbor', true),
            sw('Cheque', '', false),
            sw('Invoice (affiliates only)', 'Book now, settle monthly', true))),
        card({ title: 'Deposits & balances' },
          h('div.col', { style: { gap: '14px' } },
            sw('Allow partial payment at booking', 'Per-item deposit percentage applies', true),
            sw('Automatically charge the balance 24h before departure', 'Uses the card on file', false),
            sw('Chase unpaid balances by email', 'Sends the "Balance due" template', true)))),

      taxes: () => card({ title: 'Taxes & fees', flush: true,
        actions: [btn('Manage in Pricing', { size: 'sm', onclick: () => router.go('/pricing', { tab: 'taxes' }) })] },
        simpleTable(['Name', 'Type', 'Calculation', { label: 'Rate', align: 'num' }, 'Inclusive', 'Active'],
          db.all('tax_fee').map(t => [
            t.name, badge(F.titleCase(t.kind)), F.titleCase(t.calculation),
            t.calculation === 'percent' ? F.pct(t.rate, 1) : F.money(t.rate),
            t.is_inclusive ? badge('Included', 'info') : badge('Added on top'),
            t.is_active ? badge('Active', 'ok', true) : badge('Off', '', true),
          ]))),

      notifications: () => card({ title: 'Internal notifications', sub: 'What the team gets pinged about' },
        simpleTable(['Event', 'Email', 'Dashboard', 'Recipients'],
          [
            ['New booking', true, true, 'Front desk'],
            ['Booking cancelled', true, true, 'Managers'],
            ['Refund issued', true, false, 'Owner, Accountant'],
            ['Payment failed', true, true, 'Front desk, Managers'],
            ['Chargeback opened', true, true, 'Owner'],
            ['Departure fills up', false, true, 'Managers'],
            ['Waiver still missing 24h out', true, true, 'Front desk'],
            ['Webhook failing', true, true, 'Owner'],
          ].map(([evt, em, dash, who]) => [
            h('span.strong', evt), toggle(em, () => {}), toggle(dash, () => {}), h('span.small.muted', who),
          ]))),

      data: () => h('div.col',
        card({ title: 'Data & retention' },
          h('div.col', { style: { gap: '14px' } },
            sw('Anonymise contact details 24 months after the last booking', 'Keeps aggregate reporting intact.', false),
            sw('Keep waiver signatures for 7 years', 'Recommended by most insurers.', true),
            sw('Allow guests to request their data', 'Adds a self-service export link to confirmations.', true))),
        card({ title: 'Export everything', sub: 'One JSON file containing every table' },
          h('p.small.muted', `${db.tables().length} tables, ${F.num(db.tables().reduce((s, t) => s + db.count(t), 0))} rows.`),
          h('div.row.mt-3',
            btn('Download JSON', { icon: '↓', onclick: () => {
              const blob = new Blob([JSON.stringify(db.dump(), null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob); a.download = 'fareharbor-export.json';
              document.body.append(a); a.click(); a.remove();
              toast('Full export downloaded', { tone: 'ok' });
            } }),
            btn('Regenerate demo data', { kind: 'danger', onclick: () => confirm({
              title: 'Regenerate the whole dataset?',
              body: 'Everything you have changed in this session is discarded and a new random dataset is generated.',
              confirmLabel: 'Regenerate', tone: 'danger',
              onConfirm: () => { db.reset(Math.floor(Math.random() * 1e8)); toast('New dataset generated', { tone: 'ok' }); },
            }) }))),
        card({ title: 'Row counts by table', flush: true },
          simpleTable(['Table', { label: 'Rows', align: 'num' }],
            db.tables().map(t => [h('span.mono.small', t), F.num(db.count(t))])))),
    };

    return h('div.page',
      pageHead({ title: 'Settings', sub: 'Everything that configures how the platform behaves for your company.' }),
      moduleIntro(this),
      h('div.split',
        sidenav(SECTIONS, section, id => router.patchQuery({ section: id })),
        h('div', panes[section]())));

    function f(label, control, hint, wide) {
      return h('div.field', { style: wide ? { gridColumn: '1 / -1' } : null },
        h('label', label), control, hint && h('div.hint', hint));
    }
    function sw(title, sub, on) {
      return h('div.row', h('div', { style: { flex: 1 } },
        h('div.small.strong', title), sub && h('div.small.muted', sub)), toggle(on, () => {}));
    }
  },
};

function editLocation(ctx, l) {
  const { db } = ctx;
  const d = l ? { ...l } : { name: '', kind: 'meeting_point', address: '', directions: '', is_active: true, lat: 0, lng: 0 };
  modal({
    title: l ? `Edit ${l.name}` : 'New location',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Name'),
        h('input.input', { value: d.name, oninput: e => { d.name = e.target.value; } })),
      h('div.field', h('label', 'Kind'), select(['office', 'meeting_point', 'dock', 'shop', 'warehouse'], d.kind, v => { d.kind = v; })),
      h('div.field', h('label', 'Address'), h('input.input', { value: d.address, oninput: e => { d.address = e.target.value; } })),
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Arrival directions (shown to guests)'),
        h('textarea.textarea', { value: d.directions, oninput: e => { d.directions = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Save', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name it', { tone: 'warn' });
        if (l) db.update('location', l.pk, d); else db.insert('location', { company: ctx.domain.company().pk, ...d });
        api.close(); toast('Saved', { tone: 'ok' });
      } })],
  });
}

function editPolicy(ctx, p) {
  const { db } = ctx;
  const d = p ? { ...p } : { name: '', cutoff_hours: 24, refund_pct: 0, description: '' };
  modal({
    title: p ? `Edit ${p.name}` : 'New cancellation policy',
    render: () => h('div.col',
      h('div.grid.c2',
        h('div.field', h('label', 'Policy name'), h('input.input', { value: d.name, oninput: e => { d.name = e.target.value; } })),
        h('div.field', h('label', 'Free-cancellation window (hours before departure)'),
          h('input.input', { type: 'number', value: d.cutoff_hours, oninput: e => { d.cutoff_hours = Number(e.target.value); } })),
        h('div.field', h('label', 'Refund after the cutoff (0 = none, 1 = full)'),
          h('input.input', { type: 'number', step: '0.05', value: d.refund_pct, oninput: e => { d.refund_pct = Number(e.target.value); } }))),
      h('div.field.mt-3', h('label', 'Guest-facing wording'),
        h('textarea.textarea', { value: d.description, oninput: e => { d.description = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Save', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name it', { tone: 'warn' });
        if (p) db.update('cancellation_policy', p.pk, d); else db.insert('cancellation_policy', { company: ctx.domain.company().pk, ...d });
        api.close(); toast('Saved', { tone: 'ok' });
      } })],
  });
}

function editLodging(ctx, l) {
  const { db } = ctx;
  const d = l ? { ...l } : { name: '', address: '', zone: 'Downtown', pickup_offset_minutes: -30, is_active: true };
  modal({
    title: l ? `Edit ${l.name}` : 'New lodging',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Lodging name'),
        h('input.input', { value: d.name, oninput: e => { d.name = e.target.value; } })),
      h('div.field', h('label', 'Address'), h('input.input', { value: d.address, oninput: e => { d.address = e.target.value; } })),
      h('div.field', h('label', 'Zone'), h('input.input', { value: d.zone, oninput: e => { d.zone = e.target.value; } })),
      h('div.field', h('label', 'Pickup offset (minutes before departure, negative)'),
        h('input.input', { type: 'number', value: d.pickup_offset_minutes, oninput: e => { d.pickup_offset_minutes = Number(e.target.value); } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Save', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name it', { tone: 'warn' });
        if (l) db.update('lodging', l.pk, d); else db.insert('lodging', { company: ctx.domain.company().pk, ...d });
        api.close(); toast('Saved', { tone: 'ok' });
      } })],
  });
}
