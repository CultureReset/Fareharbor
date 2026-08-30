# The FareHarbor Platform — Complete Map

Scope, information architecture, UI and UX of the whole system, section by
section. This is the reference document; the prototype in this repository is the
same map made clickable.

---

## 1. What the platform is

FareHarbor is booking and management software for **tour, activity, attraction
and rental operators** — businesses that sell a seat on a boat, a slot on a
trail, a bike for four hours, or a timed ticket to a museum.

It replaces four things at once: the paper diary, the availability spreadsheet,
the standalone card terminal, and the manual reminder emails.

### Two faces

| | **Dashboard** | **Lightframe** |
|---|---|---|
| Who uses it | The operator's team | The guest |
| Where it runs | `fareharbor.com/dashboard` | Embedded on the operator's own website |
| What it does | Manage everything | Buy a seat in a few taps |
| Design goal | Density. Answer any question in two clicks. | Not feeling handed off to a third party. |

The Lightframe is the product's signature: rather than sending a visitor to a
different checkout domain, the booking flow opens as an overlay **on top of** the
operator's own page. The guest never leaves the site they trusted.

### The commercial model, and why it shapes the data

FareHarbor generally charges the operator nothing for the software and instead
takes a booking fee, usually passed to the guest as a line item at checkout.
Two consequences run all the way down into the schema:

1. A "Booking Service Fee" is modelled exactly like sales tax — a percentage
   layered on the discounted subtotal, itemised on the receipt. Hence one
   `tax_fee` table covering both.
2. FareHarbor sits in the money flow as merchant of record. Cards are collected
   by the platform, fees deducted, and the remainder settled to the operator on
   a schedule. Hence `payout` is a first-class table, not an export.

### Adjacent products in the FareHarbor ecosystem

Beyond the dashboard itself, the platform surrounds itself with: **Compass**
(marketing, SEO and support content), **built-for-you websites**, **digital
waivers**, **gift cards**, **memberships**, **kiosk and point-of-sale hardware**,
a **check-in app**, an **external REST API with webhooks**, and the
**distribution network** connecting operators to resellers and marketplaces.
Each of those appears in this map as the dashboard section that configures it.

---

## 2. Information architecture

Nine areas. Each answers a different question.

| Area | Answers | Sections |
|---|---|---|
| **Overview** | What needs my attention right now? | Home, Today, Tasks |
| **Operations** | What is happening, and is it ready to go? | Bookings, Calendar, Check-in & Manifests, Resources |
| **Catalog** | What do we sell, when, and for how much? | Items, Pricing & Promos, Custom Fields, Waivers |
| **Guests** | Who are our customers and what do we say to them? | Contacts, Messaging, Gift Cards, Memberships |
| **Money** | What came in, what went out, does it reconcile? | Payments, Payouts |
| **Distribution** | How do bookings reach us? | Affiliates & Channels, Book Buttons, Marketplaces |
| **Insights** | What is the business actually doing? | Reports |
| **Admin** | Who can do what, and how does it connect? | Users & Roles, Settings, Integrations & API, Activity Log |
| **Reference** | How does the system itself work? | Data Model, Platform Map, New Booking, Guest Storefront |

### Persistent chrome

Present on every screen:

- **Brand bar** — company name, sidebar collapse.
- **Global search** — one box, fanned out to every section that opts in.
  Confirmation numbers, guest names and emails, item names, gift card codes,
  table names. Results are grouped by section.
- **Book button** — booking is the single most common action; it is never more
  than one click or one keystroke (`B`) away.
- **Command palette** (`⌘K`) — every section plus section-supplied verbs.
- **Theme toggle**, **account menu** with role display and *act as another user*.
- **Sidebar** — grouped, with live counters on sections that have a backlog
  (unpaid bookings, open tasks, outstanding waivers, failing webhooks).

### Navigation conventions

- **Hash routing**: `#/<section>/<sub>/<id>?filters`.
- **Everything is a link.** Filters, tabs and open records live in the URL, so
  any state is shareable and survives reload.
- **Lists open drawers, not pages** for records you skim (bookings, resources,
  gift cards). Records you *work in* get a full page with tabs (items, contacts).

---

## 3. The sections

### Overview

#### Home
The landing screen. Answers "how are we doing, and what is on fire?"

- Five KPI tiles with period-over-period deltas and sparklines: booked revenue,
  bookings, guests, average booking value, capacity used.
- Booking value by day, as bars over the selected range.
- Channel mix donut — where bookings came from, by value.
- Today's departure board with capacity, crew and check-in progress.
- **Needs attention** — balances outstanding, waivers due, departures without
  crew, open tasks, failing webhooks. Each is a link into the filtered list.
- Three worklists: balances to collect, waivers due this week, departures
  without crew.
- Live activity feed from the audit log.

*UX intent:* the operator opens this with coffee. Everything actionable is one
click from here; nothing requires reading a number and then going to find it.

#### Today
Every departure on one date, in time order. The screen a front-desk lead keeps
open all day.

- Counts: departures, guests expected, seats filled, value on the water, and
  cash to collect at the desk.
- A warning strip for departures that have guests but no boat, van or guide.
- "Shape of the day" — guests by hour, so the crunch is visible at a glance.
- A departure board: time, item, capacity meter, crew, check-in progress, flags
  (balance due, waivers missing, ready), and buttons into the manifest.

#### Tasks
The shared worklist. Some rows are generated from booking state (unpaid balances,
missing waivers); some are typed in (maintenance, callbacks, reviews). Assignee,
due date, priority, bulk close and reassign.

---

### Operations

#### Bookings
The reservation list, and the deepest screen in the platform.

**List** — six saved views (all, upcoming, departing today, balance due, waivers
outstanding, cancelled), five filters, full-text search across confirmation
numbers and guest details, bulk resend/check-in/cancel, CSV export.

**Detail panel** — eight tabs:
| Tab | Holds |
|---|---|
| Overview | Reservation facts, money breakdown, guest card |
| Guests | One row per seat: name, type, price, waiver, check-in — editable |
| Payments | Every charge, refund, void and chargeback with fees and net |
| Answers | Custom field responses, booking-level and per guest |
| Waivers | Signatures with timestamp, IP, minor and guardian |
| Messages | Every message sent about this booking, with delivery state |
| Notes | Internal / manifest-visible / guest-visible, with authorship |
| History | The chronological record of what happened to this booking |

**Actions** — take payment, check in, resend confirmation, move to another
departure (with seat-availability checking), cancel with a policy-computed and
overridable refund.

*UX intent:* an agent on the phone should never need a second screen. Every fact
about a reservation and every action on it are in one panel.

#### Calendar
Four views over the same availability data.

- **Month** — a cell per day, up to four departures each, colour-coded by
  capacity state (open / filling / full / cancelled), with a seats-sold ratio.
- **Week** — a column per day, every departure listed.
- **Day** — an hour rail with departures placed in their slot.
- **List** — a flat table for scanning or exporting.

Clicking a departure opens its editor: capacity, status, online availability,
headline override, internal note, assigned resources, and its bookings.

**Add departures** is the recurrence-rule builder: item, date window, days of
the week, times, capacity — with a live count of how many rows will be created,
and an option to save the rule as a reusable schedule.

#### Check-in & Manifests
The day-of view, designed for a phone at the dock.

The manifest is a join: availability → bookings → booking customers, plus waiver
signatures, manifest-flagged custom field answers, guest-visible notes, and
pickup lodgings. One screen shows every guest with a tick box, their customer
type, waiver state, dietary or height answers, pickup time, and any balance.

Alongside: crew and craft assigned, notes for the crew, and a pickup schedule
computed from each lodging's offset.

#### Resources
Boats, vans, gear fleets, rooms and guides — and what is committed to which
departure.

- An assignment board for a chosen date: every departure with its assigned
  resources, and an Assign button on the ones with guests and nothing committed.
- **Clash detection** — a resource assigned to two overlapping departures on the
  same day is called out by name and time.
- Maintenance state, so an out-of-service boat is visible before it is assigned.

---

### Catalog

#### Items
The product catalog. Each item is a full page with seven tabs.

| Tab | Configures |
|---|---|
| Overview | Name, headline, description, category, duration, capacity, meeting point, cancellation policy — with a live guest-facing preview |
| Pricing | A rate per customer type, editable inline, with cost basis and margin; the taxes and fees that apply |
| Schedule | The recurrence rules that generate this item's departures |
| Departures | Every upcoming slot with its capacity and online status |
| Booking rules | Party size limits, online cutoff, deposit, waiver requirement, online availability |
| Online & content | Listing copy, URL slug, where the item is sold, and its embed code |
| Performance | Bookings, revenue, average value and utilisation over 90 days; channel mix; recent bookings |

#### Pricing & Promos
Four tabs.

- **Rate matrix** — every item against every customer type in one editable grid.
  The fastest way to do a seasonal price change.
- **Customer types** — Adult, Child, Infant, Senior, Student, Observer. Each has
  a *counts against capacity* switch: a lap infant or a non-participating
  observer can be on a booking without consuming a seat.
- **Taxes & fees** — percentage, flat per booking, or flat per guest; inclusive
  or added on top. With a worked example showing exactly how a receipt is built.
- **Promo codes** — discount type and value, date window, usage cap with a
  redemption meter, and the discount actually given.

#### Custom Fields
Operator-defined questions. Each is asked either once per booking ("emergency
contact") or once per guest ("shirt size"), and can be flagged to appear on the
manifest.

Eight field types. Each field page shows its configuration, a live guest preview,
the distribution of answers received, and the most recent responses.

#### Waivers
Templates, signatures, and the outstanding list.

- **Outstanding** — bookings whose guests have not all signed, sorted by how
  close the departure is, with one-click and bulk reminder sending.
- **Signatures** — the evidence record: signer, template version, timestamp, IP,
  and guardian details for minors.
- **Templates** — versioned wording, minor policy (guardian signs / separate
  waiver / not allowed), and a preview of the guest signing page.

---

### Guests

#### Contacts
The CRM. Deduplicated by email so lifetime value and history survive rebooking.

List with lifetime value, booking count, last booked, marketing consent and
tags. Detail page with full booking history, memberships, editable details,
tagging, internal notes, a breakdown of what they book, and duplicate detection
that merges bookings onto the surviving record.

#### Messaging
Everything the platform sends a guest.

- **Templates** bound to a trigger and an offset: confirmation, 48h and 24h
  reminders, waiver chase, balance chase, cancellation, post-trip. Email or SMS.
- **Merge tags** resolved per booking, with a rendered example.
- **Delivery log** — every message actually sent, with delivered / opened /
  bounced / failed state. The answer to "did they get it?"

Automations are state-aware: a waiver chase stops firing the moment the waiver
is signed.

#### Gift Cards
Stored value sold now and redeemed later. Face value issued, redeemed, and the
**outstanding liability** — the balance across every unredeemed card, which is a
real number on the operator's books. Expiry tracking, balance adjustment, and a
printable card.

#### Memberships
Season passes, clubs and punch cards. Plans define price, billing cadence and
benefit (percentage off / included visits / unlimited). Members carry their
renewal date and remaining entitlement. Monthly recurring value, renewal-in-30-
days and past-due counts.

---

### Money

#### Payments
The transaction ledger. Every charge, refund, void and chargeback, with its
processing fee, its status, and the payout it settled in.

Gross, refunded, fees as a percentage of gross, net, and open disputes. Filters
include *not yet settled*, which is the set of money collected but not yet paid
out. Chargebacks get their own alert strip — respond with the manifest, waiver
and check-in record as evidence.

#### Payouts
Settlement batches to the bank account.

Each payout reconciles explicitly: **gross − refunds − fees ± adjustments = net
paid**. Opening one lists every transaction it contains, each linking back to the
booking that produced it. Paid, in transit and scheduled totals; the amount not
yet in any payout; bank account and schedule.

---

### Distribution

#### Affiliates & Channels
Every route a booking can take to reach you, and what each one costs.

**Channels** — direct online, dashboard, kiosk, POS, affiliate, OTA, API. Every
booking carries one, so every report can split by it. Performance table with
share of revenue and a mix meter.

**Affiliates** — resellers, concierges, OTAs and the distribution network. Each
has a commission rate and payment terms (deducted at payout / invoiced monthly /
prepaid). Detail view shows production, what they sell, their attributed booking
link, and a settle action.

Headline metrics: direct share (revenue you keep in full) and blended take rate.

#### Book Buttons
The embeddable Lightframe entry points: buttons, inline calendars, item lists,
full-page flows and timed popups. Each carries its placement, views, bookings
and conversion rate, plus copy-ready embed code and a Lightframe preview.

#### Marketplaces
Syndicated listings — Google Things to Do and OTAs. Each maps one item to an
external product ID. Sync state, last error, and what gets pushed (title, price,
availability, capacity, cancellation policy) and when.

---

### Insights

#### Reports
A declarative report builder, not a set of fixed screens.

- **Four datasets** — Bookings, Payments, Capacity, Guests. Each declares its
  rows, its dimensions and its measures.
- **Dimensions** — item, channel, status, affiliate, staff member, promo code,
  waiver state, weekday, month, lodging, payment method, card brand, payout,
  country, frequency band, departure hour.
- **Measures** — bookings, guests, booked value, subtotal, taxes, discounts,
  collected, outstanding, average value, transactions, fees, net, seats offered,
  seats sold, utilisation, empty seats, lifetime value.
- **Twelve presets** — sales by item, channel mix, capacity utilisation, best
  days to run, affiliate production, outstanding balances, processing fees,
  taxes collected, promo performance, guest geography, repeat rate, staff
  production.
- Four chart shapes, a totals row, CSV export, and saved reports with optional
  scheduled email delivery.

---

### Admin

#### Users & Roles
Users, roles and the permission matrix.

Six built-in roles — Owner, Manager, Front Desk, Guide, Accountant, Read Only —
each a bundle of permissions across six areas. The matrix view shows every
permission against every role. Users can be restricted to specific locations.
*Act as another user* lets you see the dashboard as a guide or an accountant.

#### Settings
Eleven sections across four groups.

- **Company** — profile, shortname (the booking URL key), timezone, currency,
  brand colour; locations; operating hours and season.
- **Selling** — cancellation policies (which drive the refund calculator);
  lodgings and pickup offsets; checkout options.
- **Money** — processing, accepted methods, payout schedule, deposits and
  balance handling; taxes and fees.
- **Platform** — internal notifications; data retention; a full JSON export and
  row counts per table.

#### Integrations & API
Four tabs.

- **Connected apps** — Zapier, Mailchimp, GA4, Meta Pixel, QuickBooks, Slack,
  Xero, Twilio.
- **API keys** — scoped, revocable, with usage counts.
- **Webhooks** — endpoint, subscribed events, success rate, failures in the last
  24 hours, and a test delivery with the real payload shape.
- **API reference** — base URL, authentication headers, rate limit, the endpoint
  table, and a worked booking-creation request and response.

#### Activity Log
The append-only audit trail. Who changed what, when, from which IP. Every write
through the data layer lands here automatically — including the ones you make
while clicking around the prototype.

---

### Reference

#### Data Model
Every table, field and relationship, generated from the schema declaration.
Grouped tables with row counts, the full foreign-key map, the spine diagram,
row-volume ranking, a vocabulary glossary, and a page per table with fields,
live rows, relations in both directions, and an example row as JSON.

#### Platform Map
This document, rendered inside the app and cross-linked to the live screens.

#### New Booking
The internal five-step flow: item → departure → party → details → payment.
Live order summary throughout. Writes real rows.

#### Guest Storefront
The Lightframe as a visitor experiences it: a mock operator website, the overlay
opening over it, a month calendar showing only bookable departures, per-customer-
type counters, checkout with promo code and policy text. Bookings made here land
on the online channel and appear immediately everywhere else.

---

## 4. UI system

### Layout
A CSS grid shell: brand bar and sidebar on the left, top bar across, scrolling
content. The sidebar collapses to icons. Content is capped at 1680px and
degrades to single-column below 860px.

### Density
This is a back-office tool used all day by people who know it well. It optimises
for information per screen, not for whitespace: 13–14px base type, 9px table
cell padding, sticky table headers, tabular numerals on every figure.

### Colour as a language
The same value always gets the same colour, everywhere:

| Meaning | Used for |
|---|---|
| Green | Confirmed, active, live, paid, succeeded, signed, open, available |
| Amber | Pending, in transit, partial, tentative, filling up, past due, draft |
| Red | Cancelled, failed, bounced, disputed, no-show, error, revoked, full |
| Blue | Informational, in progress, trial |
| Purple | Enum values, redeemed, completed states |
| Grey | Paused, archived, hidden, expired, retired, not required |

Capacity is the clearest case: a departure meter runs green under 80%, amber
above, red when full — on the calendar, the day board, the manifest and the
booking wizard alike.

### Components
Card, page header, button (five kinds, three sizes, groups), badge, status
badge, stat tile, meter, key–value list, tabs, side navigation, data table,
static table, drawer, modal, menu, toast, timeline, stepper, quantity stepper,
chip, banner, avatar, code block, and six SVG chart types.

### The data table
Every list in the platform is one component. It provides sorting on any column,
debounced full-text search, declarative filters, page-size control, row
selection with bulk actions, a totals footer, CSV export, and empty states —
from a `columns` array. That is why forty-odd lists behave identically.

### Theming
All colour, spacing, radius, shadow and type scale come from CSS custom
properties in one file. Dark mode redefines the tokens; no component knows about
it.

---

## 5. UX principles the design follows

1. **Answer the question on the screen you asked it.** The manifest shows the
   dietary answer, not a link to a booking that has it.
2. **Never make someone leave a record to act on it.** Payment, check-in,
   cancellation, moving a booking, resending a confirmation — all from the
   detail panel.
3. **Show the consequence before the action.** The recurrence builder counts the
   departures it will create. The cancel dialog computes the refund. The party
   builder caps at seats remaining.
4. **Make state visible, not inferred.** Capacity meters, waiver badges, balance
   colouring, "no crew assigned" warnings.
5. **One calculation, one place.** Every price the guest, the agent, the receipt
   and the report see comes from the same function.
6. **Never delete money.** A refund is a negative payment, not an erased charge.
   A cancelled booking stays in the record.
7. **Policy proposes, a human disposes.** Refund amounts are computed and
   overridable, because weather calls and goodwill are judgement.
8. **Everything is addressable.** Any filtered list, any tab, any record is a
   URL that can be pasted into a message.
