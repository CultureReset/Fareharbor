# Data Model

Generated from [`app/data/schema.js`](../app/data/schema.js) — the same declaration the
application runs on. Regenerate it with `node tools/gen-docs.mjs > docs/DATA-MODEL.md`
after editing the schema.

**41 tables · 398 fields · 72 foreign keys**

---

## The spine

> An **item** is a product; it generates dated **availability** rows; a guest books one,
> producing a **booking** that holds a **booking_customer** per seat and a **payment** per
> transaction; payments settle in a **payout**.

```
  item ──< availability ──< booking ──< booking_customer
                              │  │
                              │  ├──< custom_field_value
                              │  ├──< waiver_signature
                              │  ├──< note
                              │  └──< message_log
                              │
                              ├──< payment ──> payout
                              ├──> contact
                              ├──> channel
                              ├──> affiliate
                              ├──> promo_code
                              └──> lodging
```

Read `──<` as "has many" and `──>` as "belongs to".

Three joins are worth internalising, because most screens are one of them:

| Screen | Join |
|---|---|
| A manifest | `availability → booking → booking_customer`, plus `waiver_signature`, `custom_field_value`, `note` |
| A guest history | `contact → booking → item`, plus `payment` and `membership` |
| A payout statement | `payout → payment → booking → item` |

---

## Conventions

Two rules run through the whole schema:

- **Money is always integer cents.** `5200` is $52.00. There are no floats in
  any money field, so totals never drift.
- **Dates and times are always strings.** `date` is `YYYY-MM-DD`, `time` is
  `HH:MM`, `datetime` is `YYYY-MM-DDTHH:MM:SS`. They sort and compare
  lexicographically and never carry a surprise timezone.

### Field types

| Type | Meaning |
|---|---|
| `id` | Primary key. String, prefixed with the table name. |
| `ref` | Foreign key. The `ref` property names the target table. |
| `string` | Short text. |
| `text` | Long text, rendered multi-line. |
| `email` | Email address. |
| `phone` | Phone number, formatted on display. |
| `url` | Absolute URL. |
| `slug` | URL-safe identifier. |
| `money` | Integer cents. |
| `int` | Whole number. |
| `float` | Decimal number. |
| `pct` | Fraction in 0..1. `0.15` renders as 15%. |
| `bool` | True or false. |
| `date` | `YYYY-MM-DD`, no time, no zone. |
| `time` | `HH:MM`, 24-hour, local to the company timezone. |
| `datetime` | `YYYY-MM-DDTHH:MM:SS`. |
| `enum` | One of a fixed set, listed in the `enum` property. |
| `json` | Nested structure. |
| `array` | List of scalars or references. |

---

## Tables by group

### Org

_Who the operator is, where they operate, and who can log in._

#### `company` — Companies

The operator account. Everything in the dashboard is scoped to one company shortname.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `shortname` | `slug` | Shortname | — | URL key: fareharbor.com/<shortname>/ |
| `name` | `string` **req** | Company name | — |  |
| `timezone` | `string` | Timezone | — |  |
| `currency` | `string` | Currency | — |  |
| `country` | `string` | Country | — |  |
| `phone` | `phone` | Phone | — |  |
| `email` | `email` | Support email | — |  |
| `website` | `url` | Website | — |  |
| `address` | `text` | Address | — |  |
| `status` | `enum` | Status | — | `active` `trial` `suspended` |
| `logo_color` | `string` | Brand color | — |  |

_Referenced by:_ `location.company`, `user.company`, `role.company`, `item.company`, `customer_type.company`, `addon.company`, `cancellation_policy.company`, `booking.company`, `contact.company`, `custom_field.company`, `payout.company`, `tax_fee.company`, `promo_code.company`, `affiliate.company`, `widget.company`, `external_listing.company`, `resource.company`, `waiver_template.company`, `lodging.company`, `task.company`, `message_template.company`, `gift_card.company`, `membership_type.company`, `api_key.company`, `webhook.company`, `activity_log.company`, `saved_report.company`

#### `location` — Locations

Physical places: offices, docks, trailheads, meeting points and shops.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` **req** | Name | — |  |
| `kind` | `enum` | Kind | — | `office` `meeting_point` `dock` `shop` `warehouse` |
| `address` | `text` | Address | — |  |
| `lat` | `float` | Latitude | — |  |
| `lng` | `float` | Longitude | — |  |
| `directions` | `text` | Arrival directions | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `item.location`, `resource.location`

#### `user` — Users

Dashboard logins. Permissions come from roles, optionally narrowed to locations.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` **req** | Name | — |  |
| `email` | `email` **req** | Email | — |  |
| `phone` | `phone` | Phone | — |  |
| `role` | `ref` | Role | [`role`](#role--roles) |  |
| `status` | `enum` | Status | — | `active` `invited` `disabled` |
| `last_login` | `datetime` | Last login | — |  |
| `two_factor` | `bool` | 2FA enabled | — |  |
| `location_scope` | `array` | Restricted to locations | — |  |

_Referenced by:_ `booking.created_by`, `note.author`, `payment.created_by`, `checkin.by_user`, `task.assignee`, `activity_log.actor`, `saved_report.owner`

#### `role` — Roles

A named bundle of permissions. Owner, Manager, Front desk, Guide, Read-only, Accountant.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` **req** | Role name | — |  |
| `description` | `text` | Description | — |  |
| `permissions` | `array` | Permission keys | — |  |
| `is_system` | `bool` | Built-in | — |  |
| `user_count` | `int` | Users | — |  |

_Referenced by:_ `user.role`

---

### Catalog

_What is for sale: products, schedules, prices and capacity._

#### `item` — Items

A bookable product — a tour, activity, rental, class, or ticket. The centre of the catalog.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` **req** | Item name | — |  |
| `slug` | `slug` | Slug | — |  |
| `category` | `enum` | Category | — | `tour` `rental` `lesson` `ticket` `charter` `event` |
| `status` | `enum` | Status | — | `live` `draft` `paused` `archived` |
| `headline` | `string` | Headline | — |  |
| `description` | `text` | Description | — |  |
| `duration_minutes` | `int` | Duration | — |  |
| `capacity_default` | `int` | Default capacity | — |  |
| `min_party` | `int` | Minimum party size | — |  |
| `max_party` | `int` | Maximum party size | — |  |
| `location` | `ref` | Meeting location | [`location`](#location--locations) |  |
| `cancellation_policy` | `ref` | Cancellation policy | [`cancellation_policy`](#cancellation_policy--cancellation-policies) |  |
| `booking_cutoff_minutes` | `int` | Online cutoff | — |  |
| `requires_waiver` | `bool` | Requires waiver | — |  |
| `online_booking` | `bool` | Bookable online | — |  |
| `deposit_pct` | `pct` | Deposit % | — |  |
| `image` | `url` | Hero image | — |  |
| `sort_order` | `int` | Sort order | — |  |

_Referenced by:_ `customer_type_rate.item`, `availability.item`, `availability_template.item`, `booking.item`, `widget.item`, `external_listing.item`

#### `customer_type` — Customer types

Who a seat is for — Adult, Child, Senior, Student, Observer. Defined per company.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `singular` | `string` **req** | Singular | — |  |
| `plural` | `string` | Plural | — |  |
| `note` | `string` | Qualifier | — | e.g. "Ages 6–12" |
| `counts_against_capacity` | `bool` | Uses a seat | — |  |

_Referenced by:_ `customer_type_rate.customer_type`

#### `customer_type_rate` — Rates

The price of one customer type on one item. Availability-level overrides create seasonal pricing.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `item` | `ref` | Item | [`item`](#item--items) |  |
| `customer_type` | `ref` | Customer type | [`customer_type`](#customer_type--customer-types) |  |
| `availability` | `ref` | Availability override | [`availability`](#availability--availabilities) |  |
| `total` | `money` | Price | — |  |
| `cost` | `money` | Cost basis | — |  |
| `minimum_party_size` | `int` | Min qty | — |  |
| `maximum_party_size` | `int` | Max qty | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `booking_customer.customer_type_rate`

#### `availability` — Availabilities

One dated, timed departure of an item with its own capacity. What guests actually book.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `item` | `ref` | Item | [`item`](#item--items) |  |
| `date` | `date` | Date | — |  |
| `start_time` | `time` | Start | — |  |
| `end_time` | `time` | End | — |  |
| `capacity` | `int` | Capacity | — |  |
| `booked` | `int` | Booked | — |  |
| `headline` | `string` | Override headline | — |  |
| `status` | `enum` | Status | — | `open` `sold_out` `cancelled` `hidden` |
| `online_status` | `enum` | Online | — | `bookable` `call_only` `closed` |
| `template` | `ref` | From template | [`availability_template`](#availability_template--schedules) |  |
| `notes` | `text` | Internal notes | — |  |

_Referenced by:_ `customer_type_rate.availability`, `booking.availability`, `resource_assignment.availability`, `checkin.availability`

#### `availability_template` — Schedules

A recurrence rule that generates availabilities: days of week, times, date range, capacity.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `item` | `ref` | Item | [`item`](#item--items) |  |
| `name` | `string` | Schedule name | — |  |
| `start_date` | `date` | Starts | — |  |
| `end_date` | `date` | Ends | — |  |
| `days_of_week` | `array` | Days | — |  |
| `times` | `array` | Departure times | — |  |
| `capacity` | `int` | Capacity per slot | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `availability.template`

#### `addon` — Add-ons

Optional extras attached to an item: photo package, wetsuit, lunch, insurance.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Name | — |  |
| `price` | `money` | Price | — |  |
| `charge_basis` | `enum` | Charged | — | `per_customer` `per_booking` |
| `items` | `array` | Applies to items | — |  |
| `inventory` | `int` | Stock | — |  |
| `is_active` | `bool` | Active | — |  |

#### `cancellation_policy` — Cancellation policies

Refund windows: how close to departure a guest can cancel and what they get back.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Name | — |  |
| `cutoff_hours` | `int` | Free-cancel window | — |  |
| `refund_pct` | `pct` | Refund after cutoff | — |  |
| `description` | `text` | Guest-facing text | — |  |

_Referenced by:_ `item.cancellation_policy`

---

### Sales

_Reservations and the people on them._

#### `booking` — Bookings

The reservation. Joins an availability to a contact, its customers, its money and its history.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `code` | `string` | Confirmation # | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `item` | `ref` | Item | [`item`](#item--items) |  |
| `availability` | `ref` | Availability | [`availability`](#availability--availabilities) |  |
| `contact` | `ref` | Contact | [`contact`](#contact--contacts) |  |
| `status` | `enum` | Status | — | `confirmed` `pending` `cancelled` `no_show` `completed` |
| `channel` | `ref` | Channel | [`channel`](#channel--channels) |  |
| `affiliate` | `ref` | Affiliate | [`affiliate`](#affiliate--affiliates) |  |
| `pax` | `int` | Guests | — |  |
| `subtotal` | `money` | Subtotal | — |  |
| `tax_total` | `money` | Taxes & fees | — |  |
| `discount_total` | `money` | Discounts | — |  |
| `total` | `money` | Total | — |  |
| `paid` | `money` | Paid | — |  |
| `balance` | `money` | Balance due | — |  |
| `created_at` | `datetime` | Booked at | — |  |
| `created_by` | `ref` | Booked by | [`user`](#user--users) |  |
| `promo_code` | `ref` | Promo code | [`promo_code`](#promo_code--promo-codes) |  |
| `lodging` | `ref` | Pickup | [`lodging`](#lodging--lodgings-pickups) |  |
| `is_checked_in` | `bool` | Checked in | — |  |
| `waiver_status` | `enum` | Waivers | — | `not_required` `pending` `partial` `signed` |
| `source_url` | `url` | Booked from | — |  |

_Referenced by:_ `booking_customer.booking`, `custom_field_value.booking`, `payment.booking`, `waiver_signature.booking`, `checkin.booking`, `task.booking`, `message_log.booking`

#### `booking_customer` — Booking customers

One seat on a booking: which customer type, at which rate, plus their custom field answers.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `booking` | `ref` | Booking | [`booking`](#booking--bookings) |  |
| `customer_type_rate` | `ref` | Rate | [`customer_type_rate`](#customer_type_rate--rates) |  |
| `name` | `string` | Name | — |  |
| `email` | `email` | Email | — |  |
| `phone` | `phone` | Phone | — |  |
| `price` | `money` | Price | — |  |
| `checked_in_at` | `datetime` | Checked in | — |  |
| `waiver_signed` | `bool` | Waiver signed | — |  |

_Referenced by:_ `custom_field_value.booking_customer`, `waiver_signature.booking_customer`

#### `contact` — Contacts

The guest record. Deduplicated by email so lifetime value and history survive rebooking.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` **req** | Name | — |  |
| `email` | `email` | Email | — |  |
| `phone` | `phone` | Phone | — |  |
| `country` | `string` | Country | — |  |
| `city` | `string` | City | — |  |
| `marketing_opt_in` | `bool` | Marketing consent | — |  |
| `booking_count` | `int` | Bookings | — |  |
| `lifetime_value` | `money` | Lifetime value | — |  |
| `first_booked` | `date` | First booked | — |  |
| `last_booked` | `date` | Last booked | — |  |
| `tags` | `array` | Tags | — |  |
| `notes` | `text` | Notes | — |  |

_Referenced by:_ `booking.contact`, `membership.contact`

#### `note` — Notes

Free text on a booking or contact. Internal notes never reach the guest; public ones do.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `target_type` | `enum` | Attached to | — | `booking` `contact` `availability` `item` |
| `target` | `ref` | Target ID | — |  |
| `visibility` | `enum` | Visibility | — | `internal` `guest_visible` `manifest` |
| `body` | `text` | Note | — |  |
| `author` | `ref` | Author | [`user`](#user--users) |  |
| `created_at` | `datetime` | Created | — |  |

#### `custom_field` — Custom fields

Operator-defined questions. Attach at booking, per-customer, or item level; feed the manifest.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `title` | `string` **req** | Question | — |  |
| `type` | `enum` | Field type | — | `short_text` `long_text` `number` `select` `multi_select` `checkbox` `date` `file` |
| `level` | `enum` | Asked at | — | `booking` `customer` `item` |
| `options` | `array` | Choices | — |  |
| `is_required` | `bool` | Required | — |  |
| `show_on_manifest` | `bool` | On manifest | — |  |
| `items` | `array` | Applies to items | — |  |
| `description` | `text` | Helper text | — |  |

_Referenced by:_ `custom_field_value.custom_field`

#### `custom_field_value` — Custom field answers

The answer a guest or agent gave, joined back to the booking or the individual customer.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `custom_field` | `ref` | Field | [`custom_field`](#custom_field--custom-fields) |  |
| `booking` | `ref` | Booking | [`booking`](#booking--bookings) |  |
| `booking_customer` | `ref` | Customer | [`booking_customer`](#booking_customer--booking-customers) |  |
| `value` | `string` | Answer | — |  |

---

### Money

_Charges, refunds, taxes, and the payouts that settle them._

#### `payment` — Payments

Every money movement against a booking: card charges, cash, refunds, voids, chargebacks.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `booking` | `ref` | Booking | [`booking`](#booking--bookings) |  |
| `kind` | `enum` | Type | — | `charge` `refund` `void` `chargeback` `adjustment` |
| `method` | `enum` | Method | — | `card` `cash` `check` `gift_card` `invoice` `apple_pay` `terminal` |
| `amount` | `money` | Amount | — |  |
| `fee` | `money` | Processing fee | — |  |
| `net` | `money` | Net | — |  |
| `status` | `enum` | Status | — | `succeeded` `pending` `failed` `refunded` `disputed` |
| `card_brand` | `string` | Card | — |  |
| `card_last4` | `string` | Last 4 | — |  |
| `processor_ref` | `string` | Processor ref | — |  |
| `created_at` | `datetime` | Processed | — |  |
| `payout` | `ref` | Payout | [`payout`](#payout--payouts) |  |
| `created_by` | `ref` | Taken by | [`user`](#user--users) |  |

#### `payout` — Payouts

A settlement batch wired to the operator bank account. Gross minus fees minus refunds.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `reference` | `string` | Reference | — |  |
| `period_start` | `date` | Period start | — |  |
| `period_end` | `date` | Period end | — |  |
| `gross` | `money` | Gross sales | — |  |
| `refunds` | `money` | Refunds | — |  |
| `fees` | `money` | Fees | — |  |
| `adjustments` | `money` | Adjustments | — |  |
| `net` | `money` | Net paid | — |  |
| `status` | `enum` | Status | — | `paid` `in_transit` `scheduled` `failed` |
| `paid_on` | `date` | Paid on | — |  |
| `bank_last4` | `string` | Bank acct | — |  |
| `transaction_count` | `int` | Transactions | — |  |

_Referenced by:_ `payment.payout`

#### `tax_fee` — Taxes & fees

Percentage or flat charges layered onto a booking: sales tax, park fee, fuel surcharge.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Name | — |  |
| `kind` | `enum` | Type | — | `tax` `fee` |
| `calculation` | `enum` | Calculation | — | `percent` `flat_per_booking` `flat_per_customer` |
| `rate` | `float` | Rate | — |  |
| `applies_to` | `array` | Applies to items | — |  |
| `is_inclusive` | `bool` | Included in price | — |  |
| `is_active` | `bool` | Active | — |  |

#### `promo_code` — Promo codes

Discount codes with usage caps, date windows, and item or channel restrictions.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `code` | `string` **req** | Code | — |  |
| `kind` | `enum` | Discount | — | `percent` `fixed` |
| `value` | `float` | Value | — |  |
| `starts` | `date` | Valid from | — |  |
| `ends` | `date` | Valid until | — |  |
| `max_uses` | `int` | Usage cap | — |  |
| `used` | `int` | Times used | — |  |
| `items` | `array` | Limited to items | — |  |
| `channels` | `array` | Limited to channels | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `booking.promo_code`

---

### Distribution

_Every channel a booking can arrive through._

#### `channel` — Channels

Where a booking originated. Every booking carries one; every report can split by it.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `name` | `string` | Channel | — |  |
| `kind` | `enum` | Kind | — | `direct_online` `dashboard` `kiosk` `pos` `affiliate` `ota` `api` |
| `commission_pct` | `pct` | Typical commission | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `booking.channel`

#### `affiliate` — Affiliates

Resellers, concierges and OTAs who sell your inventory, each on their own commission terms.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Affiliate | — |  |
| `kind` | `enum` | Type | — | `reseller` `concierge` `ota` `network` |
| `contact_name` | `string` | Contact | — |  |
| `email` | `email` | Email | — |  |
| `phone` | `phone` | Phone | — |  |
| `commission_pct` | `pct` | Commission | — |  |
| `payment_terms` | `enum` | Terms | — | `net_of_commission` `invoice_monthly` `prepaid` |
| `bookings_ytd` | `int` | Bookings YTD | — |  |
| `revenue_ytd` | `money` | Revenue YTD | — |  |
| `commission_owed` | `money` | Commission owed | — |  |
| `status` | `enum` | Status | — | `active` `pending` `paused` |

_Referenced by:_ `booking.affiliate`

#### `widget` — Book buttons & widgets

The embeddable Lightframe entry points: buttons, inline calendars, full-page flows.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Name | — |  |
| `kind` | `enum` | Type | — | `button` `inline_calendar` `item_list` `full_page` `popup` |
| `item` | `ref` | Item | [`item`](#item--items) |  |
| `flow` | `enum` | Flow | — | `lightframe` `new_tab` `inline` |
| `theme_color` | `string` | Accent | — |  |
| `placement` | `string` | Where it lives | — |  |
| `views_30d` | `int` | Views 30d | — |  |
| `bookings_30d` | `int` | Bookings 30d | — |  |
| `is_active` | `bool` | Active | — |  |

#### `external_listing` — Marketplace listings

Syndicated listings — Google Things to Do, OTAs — with their sync state and last error.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `marketplace` | `string` | Marketplace | — |  |
| `item` | `ref` | Item | [`item`](#item--items) |  |
| `external_id` | `string` | External ID | — |  |
| `sync_status` | `enum` | Sync | — | `live` `syncing` `error` `paused` |
| `last_sync` | `datetime` | Last sync | — |  |
| `last_error` | `string` | Last error | — |  |
| `bookings_30d` | `int` | Bookings 30d | — |  |

---

### Operations

_Running the day: manifests, check-in, resources, waivers._

#### `resource` — Resources

Finite things a departure consumes: boats, vans, bikes, rooms and the guides who run it.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Resource | — |  |
| `kind` | `enum` | Type | — | `vehicle` `vessel` `equipment` `staff` `room` |
| `capacity` | `int` | Capacity | — |  |
| `location` | `ref` | Home location | [`location`](#location--locations) |  |
| `status` | `enum` | Status | — | `available` `in_use` `maintenance` `retired` |
| `notes` | `text` | Notes | — |  |

_Referenced by:_ `resource_assignment.resource`

#### `resource_assignment` — Resource assignments

Which resource is committed to which departure. Double-booking is detected here.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `resource` | `ref` | Resource | [`resource`](#resource--resources) |  |
| `availability` | `ref` | Availability | [`availability`](#availability--availabilities) |  |
| `role` | `string` | Role | — |  |
| `status` | `enum` | Status | — | `assigned` `tentative` `released` |

#### `waiver_template` — Waiver templates

The legal document guests sign, with the signer rules and which items require it.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Template | — |  |
| `version` | `string` | Version | — |  |
| `body` | `text` | Waiver text | — |  |
| `minor_policy` | `enum` | Minors | — | `guardian_signs` `separate_waiver` `not_allowed` |
| `items` | `array` | Required for items | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `waiver_signature.template`

#### `waiver_signature` — Signatures

One signed waiver, tied to a person on a booking, with IP and timestamp for evidence.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `template` | `ref` | Template | [`waiver_template`](#waiver_template--waiver-templates) |  |
| `booking` | `ref` | Booking | [`booking`](#booking--bookings) |  |
| `booking_customer` | `ref` | Signer | [`booking_customer`](#booking_customer--booking-customers) |  |
| `signer_name` | `string` | Signed by | — |  |
| `signed_at` | `datetime` | Signed at | — |  |
| `ip_address` | `string` | IP | — |  |
| `is_minor` | `bool` | Minor | — |  |
| `guardian_name` | `string` | Guardian | — |  |

#### `checkin` — Check-ins

The day-of record: who showed up, when, and on which device.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `booking` | `ref` | Booking | [`booking`](#booking--bookings) |  |
| `availability` | `ref` | Availability | [`availability`](#availability--availabilities) |  |
| `checked_in_count` | `int` | Checked in | — |  |
| `total_count` | `int` | Expected | — |  |
| `checked_in_at` | `datetime` | Time | — |  |
| `by_user` | `ref` | By | [`user`](#user--users) |  |
| `device` | `enum` | Device | — | `dashboard` `mobile_app` `kiosk` `scanner` |

#### `lodging` — Lodgings & pickups

Hotels and stops guests can be collected from, with pickup offsets per item.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Lodging | — |  |
| `address` | `text` | Address | — |  |
| `pickup_offset_minutes` | `int` | Pickup offset | — |  |
| `zone` | `string` | Zone | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `booking.lodging`

#### `task` — Tasks

Follow-ups the team owes: unpaid balances, missing waivers, callbacks, damage reports.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `title` | `string` | Task | — |  |
| `kind` | `enum` | Type | — | `balance_due` `waiver_missing` `callback` `maintenance` `review` `other` |
| `booking` | `ref` | Related booking | [`booking`](#booking--bookings) |  |
| `assignee` | `ref` | Assigned to | [`user`](#user--users) |  |
| `due_date` | `date` | Due | — |  |
| `priority` | `enum` | Priority | — | `low` `normal` `high` `urgent` |
| `status` | `enum` | Status | — | `open` `in_progress` `done` `dismissed` |

---

### Engagement

_Messaging, marketing, gift cards, memberships._

#### `message_template` — Message templates

Automated guest email and SMS: confirmations, reminders, waiver chases, post-trip reviews.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Template | — |  |
| `trigger` | `enum` | Trigger | — | `booking_confirmed` `reminder_24h` `reminder_48h` `waiver_request` `balance_due` `cancelled` `post_trip` `manual` |
| `medium` | `enum` | Medium | — | `email` `sms` |
| `subject` | `string` | Subject | — |  |
| `body` | `text` | Body | — |  |
| `offset_hours` | `int` | Send offset | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `message_log.template`

#### `message_log` — Message log

Every message actually sent, with delivery state — the answer to "did they get it?"

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `template` | `ref` | Template | [`message_template`](#message_template--message-templates) |  |
| `booking` | `ref` | Booking | [`booking`](#booking--bookings) |  |
| `to` | `string` | Recipient | — |  |
| `medium` | `enum` | Medium | — | `email` `sms` |
| `subject` | `string` | Subject | — |  |
| `status` | `enum` | Status | — | `delivered` `sent` `opened` `bounced` `failed` |
| `sent_at` | `datetime` | Sent | — |  |

#### `gift_card` — Gift cards

Stored-value cards. The outstanding balance across all of them is a real liability.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `code` | `string` | Code | — |  |
| `initial_value` | `money` | Issued for | — |  |
| `balance` | `money` | Balance | — |  |
| `purchaser_name` | `string` | Purchased by | — |  |
| `purchaser_email` | `email` | Purchaser email | — |  |
| `recipient_name` | `string` | Recipient | — |  |
| `issued_on` | `date` | Issued | — |  |
| `expires_on` | `date` | Expires | — |  |
| `status` | `enum` | Status | — | `active` `redeemed` `expired` `void` |

#### `membership_type` — Membership plans

Recurring passes: season passes, unlimited clubs, multi-visit punch cards.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Plan | — |  |
| `price` | `money` | Price | — |  |
| `billing` | `enum` | Billing | — | `one_time` `monthly` `annual` |
| `benefit` | `enum` | Benefit | — | `percent_off` `free_visits` `unlimited` |
| `benefit_value` | `float` | Benefit value | — |  |
| `items` | `array` | Applies to items | — |  |
| `member_count` | `int` | Members | — |  |
| `is_active` | `bool` | Active | — |  |

_Referenced by:_ `membership.membership_type`

#### `membership` — Members

One person on one plan, with their renewal date and remaining entitlement.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `membership_type` | `ref` | Plan | [`membership_type`](#membership_type--membership-plans) |  |
| `contact` | `ref` | Member | [`contact`](#contact--contacts) |  |
| `started_on` | `date` | Started | — |  |
| `renews_on` | `date` | Renews | — |  |
| `visits_used` | `int` | Visits used | — |  |
| `status` | `enum` | Status | — | `active` `lapsed` `cancelled` `past_due` |

---

### System

_Audit, configuration and integration plumbing._

#### `api_key` — API keys

Credentials for the external API. Scoped, revocable, and individually rate-limited.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Label | — |  |
| `key_prefix` | `string` | Key | — |  |
| `scopes` | `array` | Scopes | — |  |
| `created_at` | `datetime` | Created | — |  |
| `last_used` | `datetime` | Last used | — |  |
| `requests_30d` | `int` | Requests 30d | — |  |
| `status` | `enum` | Status | — | `active` `revoked` |

#### `webhook` — Webhooks

Outbound event subscriptions. Failed deliveries retry with backoff and surface here.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `url` | `url` | Endpoint | — |  |
| `events` | `array` | Events | — |  |
| `status` | `enum` | Status | — | `active` `paused` `failing` |
| `success_rate` | `pct` | Success rate | — |  |
| `last_delivery` | `datetime` | Last delivery | — |  |
| `failures_24h` | `int` | Failures 24h | — |  |

#### `activity_log` — Activity log

Immutable audit trail. Who changed what, when, and what the value was before.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `actor` | `ref` | User | [`user`](#user--users) |  |
| `action` | `string` | Action | — |  |
| `target_type` | `string` | Object type | — |  |
| `target` | `string` | Object | — |  |
| `detail` | `string` | Detail | — |  |
| `created_at` | `datetime` | When | — |  |
| `ip_address` | `string` | IP | — |  |

#### `saved_report` — Saved reports

A stored report definition — columns, filters, grouping — optionally emailed on a schedule.

| Field | Type | Label | References | Values / notes |
|---|---|---|---|---|
| `pk` | `id` | ID | — |  |
| `company` | `ref` | Company | [`company`](#company--companies) |  |
| `name` | `string` | Report | — |  |
| `base` | `enum` | Dataset | — | `bookings` `payments` `payouts` `items` `contacts` `availability` |
| `columns` | `array` | Columns | — |  |
| `filters` | `json` | Filters | — |  |
| `group_by` | `string` | Grouped by | — |  |
| `schedule` | `enum` | Delivery | — | `none` `daily` `weekly` `monthly` |
| `recipients` | `array` | Emailed to | — |  |
| `owner` | `ref` | Owner | [`user`](#user--users) |  |

---

## Every foreign key

| From | Field | To | Meaning |
|---|---|---|---|
| `location` | `company` | `company` | Company |
| `user` | `company` | `company` | Company |
| `user` | `role` | `role` | Role |
| `role` | `company` | `company` | Company |
| `item` | `company` | `company` | Company |
| `item` | `location` | `location` | Meeting location |
| `item` | `cancellation_policy` | `cancellation_policy` | Cancellation policy |
| `customer_type` | `company` | `company` | Company |
| `customer_type_rate` | `item` | `item` | Item |
| `customer_type_rate` | `customer_type` | `customer_type` | Customer type |
| `customer_type_rate` | `availability` | `availability` | Availability override |
| `availability` | `item` | `item` | Item |
| `availability` | `template` | `availability_template` | From template |
| `availability_template` | `item` | `item` | Item |
| `addon` | `company` | `company` | Company |
| `cancellation_policy` | `company` | `company` | Company |
| `booking` | `company` | `company` | Company |
| `booking` | `item` | `item` | Item |
| `booking` | `availability` | `availability` | Availability |
| `booking` | `contact` | `contact` | Contact |
| `booking` | `channel` | `channel` | Channel |
| `booking` | `affiliate` | `affiliate` | Affiliate |
| `booking` | `created_by` | `user` | Booked by |
| `booking` | `promo_code` | `promo_code` | Promo code |
| `booking` | `lodging` | `lodging` | Pickup |
| `booking_customer` | `booking` | `booking` | Booking |
| `booking_customer` | `customer_type_rate` | `customer_type_rate` | Rate |
| `contact` | `company` | `company` | Company |
| `note` | `author` | `user` | Author |
| `custom_field` | `company` | `company` | Company |
| `custom_field_value` | `custom_field` | `custom_field` | Field |
| `custom_field_value` | `booking` | `booking` | Booking |
| `custom_field_value` | `booking_customer` | `booking_customer` | Customer |
| `payment` | `booking` | `booking` | Booking |
| `payment` | `payout` | `payout` | Payout |
| `payment` | `created_by` | `user` | Taken by |
| `payout` | `company` | `company` | Company |
| `tax_fee` | `company` | `company` | Company |
| `promo_code` | `company` | `company` | Company |
| `affiliate` | `company` | `company` | Company |
| `widget` | `company` | `company` | Company |
| `widget` | `item` | `item` | Item |
| `external_listing` | `company` | `company` | Company |
| `external_listing` | `item` | `item` | Item |
| `resource` | `company` | `company` | Company |
| `resource` | `location` | `location` | Home location |
| `resource_assignment` | `resource` | `resource` | Resource |
| `resource_assignment` | `availability` | `availability` | Availability |
| `waiver_template` | `company` | `company` | Company |
| `waiver_signature` | `template` | `waiver_template` | Template |
| `waiver_signature` | `booking` | `booking` | Booking |
| `waiver_signature` | `booking_customer` | `booking_customer` | Signer |
| `checkin` | `booking` | `booking` | Booking |
| `checkin` | `availability` | `availability` | Availability |
| `checkin` | `by_user` | `user` | By |
| `lodging` | `company` | `company` | Company |
| `task` | `company` | `company` | Company |
| `task` | `booking` | `booking` | Related booking |
| `task` | `assignee` | `user` | Assigned to |
| `message_template` | `company` | `company` | Company |
| `message_log` | `template` | `message_template` | Template |
| `message_log` | `booking` | `booking` | Booking |
| `gift_card` | `company` | `company` | Company |
| `membership_type` | `company` | `company` | Company |
| `membership` | `membership_type` | `membership_type` | Plan |
| `membership` | `contact` | `contact` | Member |
| `api_key` | `company` | `company` | Company |
| `webhook` | `company` | `company` | Company |
| `activity_log` | `company` | `company` | Company |
| `activity_log` | `actor` | `user` | User |
| `saved_report` | `company` | `company` | Company |
| `saved_report` | `owner` | `user` | Owner |

