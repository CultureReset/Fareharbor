import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, stat, empty, simpleTable, kv, sidenav, codeBlock } from '../core/ui/kit.js';
import { SCHEMA, GROUPS, relationships } from '../data/schema.js';
import * as F from '../core/format.js';

const SECTIONS = [
  { label: 'Orientation', items: [
    { id: 'what', title: 'What FareHarbor is' },
    { id: 'shape', title: 'The shape of the platform' },
    { id: 'sections', title: 'Every section, explained' },
  ] },
  { label: 'How it works', items: [
    { id: 'flows', title: 'The core flows' },
    { id: 'money', title: 'How money moves' },
    { id: 'data', title: 'How the data fits together' },
  ] },
  { label: 'This prototype', items: [
    { id: 'architecture', title: 'Architecture' },
    { id: 'extend', title: 'Adding a section' },
    { id: 'keys', title: 'Keyboard & navigation' },
  ] },
];

export default {
  id: 'guide',
  title: 'Platform Map',
  icon: '🗺',
  group: 'Reference',
  order: 270,
  summary: 'The written map: what FareHarbor is, how the pieces fit, and the flows that connect them.',
  entities: [],

  render(ctx) {
    const { registry, router, route, db } = ctx;
    const section = route.query.section || 'what';

    const panes = {
      /* ------------------------------------------------------------ */
      what: () => h('div.col',
        card({ title: 'What FareHarbor is' },
          p('FareHarbor is booking and management software for tour, activity, attraction and rental operators — '
            + 'the businesses that sell a seat on a boat, a slot on a trail, a bike for four hours, or a ticket to a museum. '
            + 'It replaces the paper diary, the spreadsheet, the card terminal and the reminder emails with one system.'),
          p('The product has two faces. The one your team sees is the ', b('Dashboard'), ' — everything in the sidebar above. '
            + 'The one your customers see is the ', b('Lightframe'), ': a booking flow that opens as an overlay on top of your '
            + 'own website, so the guest never feels handed off to a third-party checkout.'),
          h('div.grid.c2.mt-4',
            miniCard('For the operator', [
              'One calendar of every departure and its capacity',
              'A booking record that holds guests, money, waivers and notes',
              'Payments taken and settled without a separate processor',
              'Manifests on a phone at the dock',
              'Reports that reconcile to the bank',
            ]),
            miniCard('For the guest', [
              'Book in a few taps without leaving the operator’s site',
              'Instant confirmation by email or SMS',
              'A link to sign the waiver before arriving',
              'Reminders the day before',
              'Self-service rescheduling within policy',
            ]))),

        card({ title: 'The commercial model, briefly' },
          p('FareHarbor typically charges the operator nothing for the software and instead takes a booking fee, '
            + 'usually passed on to the guest as a line item at checkout. That is why the ', mono('tax_fee'),
            ' table treats a "Booking Service Fee" the same way it treats sales tax: as a percentage layered on '
            + 'top of the subtotal, visible on the receipt.'),
          p('The consequence for the data model is that FareHarbor sits in the money flow as merchant of record. '
            + 'Card payments are collected by the platform, fees are deducted, and the remainder is settled to the '
            + 'operator on a schedule — which is why ', mono('payout'), ' is a first-class table rather than an export.'))),

      /* ------------------------------------------------------------ */
      shape: () => h('div.col',
        card({ title: 'The shape of the platform' },
          p('Nine areas, each answering a different question:'),
          h('div.mt-3', simpleTable(['Area', 'Answers', 'Sections'], [
            ['Overview', 'What needs my attention right now?', 'Home, Today, Tasks'],
            ['Operations', 'What is happening, and is it ready to go?', 'Bookings, Calendar, Check-in, Resources'],
            ['Catalog', 'What do we sell, when, and for how much?', 'Items, Pricing, Custom Fields, Waivers'],
            ['Guests', 'Who are our customers and what do we say to them?', 'Contacts, Messaging, Gift Cards, Memberships'],
            ['Money', 'What came in, what went out, and does it reconcile?', 'Payments, Payouts'],
            ['Distribution', 'How do bookings reach us?', 'Affiliates & Channels, Book Buttons, Marketplaces'],
            ['Insights', 'What is the business actually doing?', 'Reports'],
            ['Admin', 'Who can do what, and how does it connect?', 'Users & Roles, Settings, Integrations, Activity Log'],
            ['Guest-facing', 'What does the buyer experience?', 'Guest Storefront'],
          ]))),

        card({ title: 'The one sentence that explains the whole thing' },
          h('div', { style: { fontSize: '17px', lineHeight: 1.6, padding: '12px 0' } },
            'An ', mono('item'), ' is a product; it generates dated ', mono('availability'),
            ' rows; a guest books one, producing a ', mono('booking'), ' that holds a ',
            mono('booking_customer'), ' per seat and a ', mono('payment'), ' per transaction; '
            + 'payments settle in a ', mono('payout'), '.'),
          p('Almost every screen in this platform is a different view onto that chain. The calendar is availabilities '
            + 'by date. The manifest is one availability joined to its bookings and their customers. A report is that '
            + 'chain grouped and totalled. Once the chain is clear, the rest of the dashboard reads itself.')),

        card({ title: 'Where each section sits on the chain' },
          simpleTable(['Chain step', 'Configured in', 'Watched in', 'Reported in'], [
            ['item', 'Items, Pricing', 'Items → Performance', 'Reports → Sales by item'],
            ['availability', 'Calendar, Items → Schedule', 'Today, Calendar', 'Reports → Capacity utilisation'],
            ['booking', 'New Booking, Guest Storefront', 'Bookings, Check-in', 'Reports → Bookings dataset'],
            ['booking_customer', 'Bookings → Guests tab', 'Check-in manifest', 'Reports → Guests measure'],
            ['payment', 'Booking → Take payment', 'Payments', 'Reports → Payments dataset'],
            ['payout', 'Automatic', 'Payouts', 'Reports → Payout reconciliation'],
          ]))),

      /* ------------------------------------------------------------ */
      sections: () => h('div.col',
        card({ title: 'Every section in this prototype' },
          p('Generated from the module registry — this list is whatever is actually registered, not a hand-written table.')),
        ...registry.nav().map(({ group, items }) => card({ title: group, flush: true },
          simpleTable(['Section', 'What it does', 'Tables it touches', ''],
            items.map(m => [
              h('div.row', { style: { gap: '8px' } }, h('span', m.icon), h('span.strong', m.title)),
              h('span.small', m.summary),
              h('div.row', { style: { gap: '3px' } }, ...(m.entities || []).map(e =>
                h('a', { href: `#/datamodel/table/${e}` }, badge(e, 'info')))),
              btn('Open', { size: 'sm', onclick: () => router.go(`/${m.id}`) }),
            ])))),
        card({ title: 'Reachable but not in the sidebar', flush: true },
          simpleTable(['Section', 'What it does', ''],
            registry.all().filter(m => m.hidden).map(m => [
              h('div.row', { style: { gap: '8px' } }, h('span', m.icon), h('span.strong', m.title)),
              h('span.small', m.summary),
              btn('Open', { size: 'sm', onclick: () => router.go(`/${m.id}`) }),
            ])))),

      /* ------------------------------------------------------------ */
      flows: () => h('div.col',
        flowCard('1 · A guest books online', [
          ['Guest lands on the operator’s website', 'A Book Now widget is embedded on the page.'],
          ['Lightframe opens over the page', 'Items, then a month calendar showing only bookable departures.'],
          ['Guest picks a date and time', 'Sold-out and closed departures are visible but not selectable.'],
          ['Guest builds the party', 'One counter per customer type; capacity decrements live.'],
          ['Guest enters details and pays', 'Price is computed by the same function the dashboard uses.'],
          ['Booking is written', 'booking + booking_customer per seat + payment; availability.booked increases.'],
          ['Confirmation and waiver links go out', 'A message_log row per message.'],
        ], '/storefront', 'Try it'),

        flowCard('2 · An agent takes a booking on the phone', [
          ['Agent opens New Booking', 'Or presses B from anywhere.'],
          ['Picks item, then departure', 'Same availability data, no online cutoff applied.'],
          ['Builds the party and attaches a guest', 'Existing contacts are matched by email.'],
          ['Answers the booking questions', 'The same custom fields the guest would have seen.'],
          ['Takes payment, a deposit, or nothing', 'Nothing leaves a balance that shows up as a task.'],
        ], '/book', 'Try it'),

        flowCard('3 · The morning of the trip', [
          ['Lead opens Today', 'Every departure in time order, with crew and check-in state.'],
          ['Unassigned departures are flagged', 'Guests booked but no boat, van or guide committed.'],
          ['Guide opens the manifest', 'Names, waivers, dietary answers, pickups, balances due.'],
          ['Guests are ticked off as they arrive', 'Per guest or per booking; writes a checkin row.'],
          ['Balances collected at the desk', 'A payment against the booking closes it out.'],
        ], '/today', 'Open Today'),

        flowCard('4 · A guest cancels', [
          ['Agent opens the booking, chooses Cancel', 'From the More menu on the booking panel.'],
          ['The policy computes the refund', 'Free-cancel window vs. percentage after cutoff.'],
          ['Agent can override the amount', 'Weather calls and goodwill are a judgement, not a rule.'],
          ['Seats return to the departure', 'availability.booked decreases; a sold-out slot reopens.'],
          ['A refund payment is written', 'Negative amount, netted off the next payout.'],
        ], '/bookings?view=all', 'Open Bookings'),

        flowCard('5 · Money reaches the bank', [
          ['Payments accumulate through the week', 'Each carries its own processing fee.'],
          ['A payout batch closes', 'Gross − refunds − fees ± adjustments = net.'],
          ['Funds settle a few days later', 'Payout status moves scheduled → in transit → paid.'],
          ['Reconciliation', 'Every payment in a payout links back to its booking.'],
        ], '/payouts', 'Open Payouts'),

        flowCard('6 · A reseller sells a seat', [
          ['Affiliate books through their own link', 'The booking is attributed to that affiliate.'],
          ['Commission accrues on booking value', 'At the affiliate’s agreed rate.'],
          ['Settlement follows the agreed terms', 'Deducted at payout, invoiced monthly, or prepaid.'],
        ], '/distribution', 'Open Distribution')),

      /* ------------------------------------------------------------ */
      money: () => h('div.col',
        card({ title: 'From list price to bank balance' },
          simpleTable(['Stage', 'What happens', 'Where it lives'], [
            ['Rate', 'A customer type has a price on an item.', mono('customer_type_rate.total')],
            ['Subtotal', 'Rate × quantity, summed across the party.', mono('booking.subtotal')],
            ['Discount', 'A promo code, capped at the subtotal.', mono('booking.discount_total')],
            ['Taxes & fees', 'Percentages and flat amounts layered on the discounted subtotal.', mono('booking.tax_total')],
            ['Total', 'What the guest owes.', mono('booking.total')],
            ['Paid / balance', 'What has actually been collected, and what has not.', mono('booking.paid') ],
            ['Payment', 'One row per charge, refund, void or chargeback, with its fee.', mono('payment.amount')],
            ['Payout', 'Gross − refunds − fees ± adjustments, wired to the bank.', mono('payout.net')],
          ]),
          h('div.mt-4', h('div.banner.info', h('div',
            h('div.strong', 'One calculation, one place'),
            h('div.small', 'The booking wizard, the guest storefront, the booking detail panel and every report all call the same '
              + 'quote() function in app/data/domain.js. If a price is wrong, there is exactly one place it can be wrong.'))))),

        card({ title: 'A worked example' }, (() => {
          const it = db.all('item')[0];
          const rates = ctx.domain.ratesFor(it.pk);
          const q = ctx.domain.quote({ item: it, lines: [{ rate: rates[0], qty: 2 }, ...(rates[1] ? [{ rate: rates[1], qty: 1 }] : [])] });
          return h('div',
            p(`Two adults and one child on ${it.name}:`),
            h('dl.kv',
              ...q.seats.flatMap(s => [
                h('dt', `${s.qty} × ${db.get('customer_type', s.rate.customer_type)?.singular} at ${F.money(s.rate.total)}`),
                h('dd.right', F.money(s.rate.total * s.qty)),
              ]),
              h('dt', 'Subtotal'), h('dd.right', F.money(q.subtotal)),
              ...q.taxLines.flatMap(t => [h('dt', t.name), h('dd.right', F.money(t.amount))]),
              h('dt', { style: { fontWeight: 700, color: 'var(--fg)' } }, 'Guest pays'),
              h('dd.right.strong', F.money(q.total))));
        })()),

        card({ title: 'Refunds' },
          p('A refund is not a deletion. Cancelling a booking writes a negative ', mono('payment'),
            ' row, returns the seats to the departure, and leaves the booking in the record marked cancelled. '
            + 'That matters: a deleted booking cannot be reconciled, disputed, or reported on.'),
          p('The amount is proposed by the item’s cancellation policy — full refund inside the free-cancellation '
            + 'window, a percentage after it — and is always overridable, because weather calls and goodwill '
            + 'are judgement, not policy.'))),

      /* ------------------------------------------------------------ */
      data: () => h('div.col',
        card({ title: 'How the data fits together' },
          p(`${SCHEMA.length} tables in ${GROUPS.length} groups, joined by ${relationships().length} foreign keys. `
            + 'The Data Model section renders all of it, field by field, from the same declaration the app runs on.'),
          h('div.mt-3', simpleTable(['Group', 'What it covers', { label: 'Tables', align: 'num' }],
            GROUPS.map(g => [h('span.strong', g.id), h('span.small', g.desc),
              SCHEMA.filter(t => t.group === g.id).length]))),
          h('div.mt-4', btn('Open the data model', { kind: 'primary', onclick: () => router.go('/datamodel') }))),

        card({ title: 'Three joins worth internalising' },
          h('div.col', { style: { gap: '16px' } },
            joinCard('A manifest',
              'availability → booking → booking_customer, plus waiver_signature, custom_field_value and note',
              'Everything a guide needs for one departure, on one screen.'),
            joinCard('A guest’s history',
              'contact → booking → item, plus payment and membership',
              'Lifetime value, what they book, and whether they are due to renew.'),
            joinCard('A payout statement',
              'payout → payment → booking → item',
              'Every settled cent traced back to the seat that produced it.'))),

        card({ title: 'Why availability is its own table' },
          p('It would be tempting to store a schedule on the item and compute departures on the fly. FareHarbor does not, '
            + 'because a departure accumulates state that a rule cannot express: this Tuesday’s boat has 12 seats instead of '
            + 'the usual 24 because one engine is down; that Saturday is closed online but still bookable by phone; the 5:30 '
            + 'is cancelled for weather but its bookings still exist.'),
          p('Making ', mono('availability'), ' a real row means every one of those exceptions survives, and the recurrence '
            + 'rule that generated it can change without rewriting history.'))),

      /* ------------------------------------------------------------ */
      architecture: () => h('div.col',
        card({ title: 'How this prototype is built' },
          p('No framework, no build step, no dependencies. Open ', mono('index.html'), ' and it runs. '
            + 'That is deliberate: the point is to be readable and modifiable, not to demonstrate tooling.'),
          h('div.mt-3', simpleTable(['Layer', 'Files', 'Responsibility'], [
            ['Rendering', 'app/core/dom.js', 'A 120-line hyperscript helper. h() returns real DOM nodes.'],
            ['State', 'app/core/store.js', 'A reactive store plus a pub/sub bus for cross-module signals.'],
            ['Routing', 'app/core/router.js', 'Hash routing. Every filter and tab lives in the URL.'],
            ['Registry', 'app/core/registry.js', 'The modularity seam. Sidebar, search and palette derive from it.'],
            ['UI kit', 'app/core/ui/*', 'DataTable, drawers, modals, charts, and the shared components.'],
            ['Schema', 'app/data/schema.js', `All ${SCHEMA.length} tables declared once, with types and relations.`],
            ['Seed', 'app/data/seed.js', 'A deterministic generator. Same seed, same data, every reload.'],
            ['Queries', 'app/data/db.js', 'query / get / rel / groupBy, plus writes that append to the audit log.'],
            ['Domain', 'app/data/domain.js', 'The business rules: pricing, capacity, refunds, manifests, metrics.'],
            ['Sections', 'app/modules/*', 'One file per section. Each exports a single module object.'],
          ]))),

        card({ title: 'What "modular" means here, concretely' },
          h('div.col', { style: { gap: '12px' } },
            bullet('Nothing in the shell names a section.', 'The sidebar, router, global search and command palette are all derived from the registry. Deleting a section is deleting one import.'),
            bullet('Every list is the same component.', 'DataTable takes column definitions and rows. Sorting, searching, filtering, pagination, selection, bulk actions and CSV export come for free.'),
            bullet('Every report is the same engine.', 'Datasets, dimensions and measures are declared in a table at the top of reports.js. Adding a report is adding a row, not writing a screen.'),
            bullet('Business rules are not in the UI.', 'A screen never computes a price or decides whether a departure is full. It asks domain.js.'),
            bullet('The data layer is swappable.', 'Modules call db.query(), never a raw array. Pointing this at a real API means changing one file.'))),

        card({ title: 'Where to change things' },
          simpleTable(['To change…', 'Edit'], [
            ['Colours, spacing, typography', mono('styles/tokens.css')],
            ['A table or a field', mono('app/data/schema.js')],
            ['How much demo data, and of what shape', mono('app/data/seed.js')],
            ['A pricing or capacity rule', mono('app/data/domain.js')],
            ['What a list column shows', 'the columns array in that section']  ,
            ['Which sections exist', 'the MODULES array in ' + 'app/main.js'],
          ]))),

      /* ------------------------------------------------------------ */
      extend: () => h('div.col',
        card({ title: 'Adding a section' },
          p('Create a file in ', mono('app/modules/'), ', add one import line to ', mono('app/main.js'),
            '. That is the whole procedure — the sidebar, routing, global search and command palette pick it up automatically.'),
          codeBlock(`// app/modules/inventory.js
import { h } from '../core/dom.js';
import { pageHead, card, stat } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id:      'inventory',            // URL segment: #/inventory
  title:   'Inventory',            // sidebar + page label
  icon:    '📦',
  group:   'Operations',           // sidebar heading
  order:   75,                     // position inside the group
  summary: 'Consumables and stock levels per location.',
  entities: ['resource'],          // documented on the Platform Map

  // optional: a counter beside the sidebar entry
  badge: (ctx) => ctx.db.where('resource', r => r.status === 'maintenance').length,

  // optional: contribute to the global search box
  search: (q, ctx) => ctx.db
    .where('resource', r => r.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 5)
    .map(r => ({ title: r.name, sub: r.kind, path: '/inventory' })),

  // optional: extra entries in the command palette
  commands: () => [{ title: 'Inventory — needs service', path: '/inventory?f=service' }],

  render(ctx) {
    const { db } = ctx;
    return h('div.page',
      pageHead({ title: 'Inventory', sub: 'Stock by location' }),
      moduleIntro(this),
      card({ flush: true }, dataTable({
        rows: db.all('resource'),
        columns: [
          { key: 'name',     label: 'Item' },
          { key: 'kind',     label: 'Type' },
          { key: 'capacity', label: 'Units', align: 'num' },
        ],
      })));
  },
};`),
          h('div.mt-4', p('Then in ', mono('app/main.js'), ':')),
          codeBlock(`import inventory from './modules/inventory.js';

const MODULES = [
  home, todayMod, tasks,
  bookings, calendar, checkin, resources, inventory,   // ← added
  /* … */
];`)),

        card({ title: 'Adding a table' },
          p('Declare it in ', mono('app/data/schema.js'), ' and it becomes browsable in the Data Model section immediately, '
            + 'with typed field rendering and its relationships mapped. Add rows to it in ', mono('seed.js'), ' if you want '
            + 'realistic data to look at.'),
          codeBlock(`T('inventory_item', 'Inventory', 'Operations',
  'Consumable stock held at a location.', [
  f('pk', 'id', 'ID'),
  f('company',  'ref',   'Company',  { ref: 'company' }),
  f('location', 'ref',   'Location', { ref: 'location' }),
  f('name',     'string', 'Item',    { required: true }),
  f('on_hand',  'int',    'Units on hand'),
  f('reorder_at','int',   'Reorder point'),
  f('unit_cost','money',  'Unit cost'),
]),`)),

        card({ title: 'Adding a report' },
          p('Reports are declarative. A new dataset is an entry in the ', mono('DATASETS'), ' map in ',
            mono('app/modules/reports.js'), ' naming its rows, its dimensions and its measures. The builder, '
            + 'the charts, the totals and the CSV export are generic over that declaration.'))),

      /* ------------------------------------------------------------ */
      keys: () => h('div.col',
        card({ title: 'Keyboard', flush: true },
          simpleTable(['Key', 'Does'], [
            [kbd('⌘K') , 'Command palette — every section and quick action'],
            [kbd('/'), 'Focus the global search box'],
            [kbd('B'), 'Start a new booking'],
            [kbd('T'), 'Toggle light and dark'],
            [kbd('\\'), 'Collapse the sidebar'],
            [h('span', kbd('G'), ' then ', kbd('H')), 'Go home'],
            [h('span', kbd('G'), ' then ', kbd('B')), 'Go to bookings'],
            [h('span', kbd('G'), ' then ', kbd('C')), 'Go to the calendar'],
            [h('span', kbd('G'), ' then ', kbd('I')), 'Go to items'],
            [h('span', kbd('G'), ' then ', kbd('R')), 'Go to reports'],
            [h('span', kbd('G'), ' then ', kbd('T')), 'Go to today'],
            [kbd('Esc'), 'Close the top drawer, modal or menu'],
          ])),
        card({ title: 'Everything is a link' },
          p('Filters, tabs and open records all live in the URL. ', mono('#/bookings?view=balance'),
            ' is a shareable link to the unpaid list; ', mono('#/reports?preset=channel-mix&range=90d'),
            ' is a shareable report; ', mono('#/datamodel/table/booking'), ' is a shareable schema page. '
            + 'Reload any of them and you land in the same place.')),
        card({ title: 'Try these' }, h('div.row',
          ...[
            ['Unpaid bookings', '/bookings?view=balance'],
            ['Today’s departures', '/today'],
            ['Capacity utilisation report', '/reports?preset=utilisation'],
            ['Book as a guest', '/storefront'],
            ['Take a phone booking', '/book'],
            ['The booking table', '/datamodel/table/booking'],
          ].map(([t, path]) => btn(t, { size: 'sm', onclick: () => router.go(path) })))),
        card({ title: 'Acting as someone else' },
          p('The account menu in the top right has ', b('Switch acting user'), '. Pick a Guide or an Accountant and '
            + 'look at Users & Roles → Permission matrix to see what each role is meant to be able to do.'))),
    };

    return h('div.page',
      pageHead({
        title: 'Platform Map',
        sub: 'What this system is, how the parts fit, and how to change it.',
        actions: [btn('Open the data model', { onclick: () => router.go('/datamodel') })],
      }),
      h('div.split',
        sidenav(SECTIONS, section, id => router.patchQuery({ section: id })),
        h('div', panes[section]())));
  },
};

/* ------------------------------------------------------------ helpers */
const p = (...kids) => h('p', { style: { lineHeight: 1.65, marginBottom: '12px' } }, ...kids);
const b = (s) => h('strong', s);
const mono = (s) => h('span.mono.strong', s);
const kbd = (s) => h('span.mono', {
  style: { border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '1px 6px', background: 'var(--surface-2)' },
}, s);

const miniCard = (title, items) => h('div', { style: { border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px' } },
  h('div.strong.mb-2', title),
  h('ul', { style: { margin: 0, paddingLeft: '18px', fontSize: 'var(--fs-md)', lineHeight: 1.7 } },
    ...items.map(i => h('li', i))));

const bullet = (title, body) => h('div',
  h('div.small.strong', title), h('div.small.muted', body));

const joinCard = (title, join, why) => h('div', { style: { borderLeft: '3px solid var(--primary)', paddingLeft: '12px' } },
  h('div.strong', title),
  h('div.mono.small.mt-2', { style: { color: 'var(--primary)' } }, join),
  h('div.small.muted.mt-2', why));

function flowCard(title, steps, path, cta) {
  return card({ title, actions: path ? [btn(cta, { size: 'sm', kind: 'primary', onclick: () => { location.hash = '#' + path; } })] : null },
    h('ol', { style: { margin: 0, paddingLeft: '20px', lineHeight: 1.7 } },
      ...steps.map(([what, detail]) => h('li', { style: { marginBottom: '8px' } },
        h('span.strong', what),
        h('div.small.muted', detail)))));
}
