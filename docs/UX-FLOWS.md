# Core Flows

Six journeys through the platform, end to end. Each names the screens involved
and the rows that get written, so the UX and the data model can be read against
each other.

Every flow below is clickable in the prototype.

---

## 1 · A guest books on the operator's website

**Try it:** `#/storefront`

| Step | Screen | What the guest sees | What is written |
|---|---|---|---|
| 1 | Operator's website | A **Book Now** button or an inline calendar, embedded from **Book Buttons** | — |
| 2 | Lightframe opens | An overlay *on top of* the site, not a redirect | — |
| 3 | Pick a date | A month calendar with a dot on every day that has a bookable departure | — |
| 4 | Pick a time | Departure times with seats remaining. Sold-out, cancelled and online-closed slots are visible but unselectable | — |
| 5 | Build the party | One counter per customer type, each capped at seats remaining | — |
| 6 | Enter details, apply a promo code | Live receipt: subtotal, discount, each tax and fee, total | — |
| 7 | Pay | Cancellation policy and waiver requirement shown before the button | `contact` (or matched by email), `booking`, one `booking_customer` per seat, `payment` |
| 8 | Confirmation | Confirmation number, what was booked, where to meet | `message_log`; `availability.booked` increases; `contact.lifetime_value` rolls up |

The booking is attributed to the **Website — Lightframe** channel and appears
immediately in Bookings, on Today's board, on the manifest and in every report.

**Design notes**

- The calendar never shows a day the guest cannot book. Dead ends are removed,
  not explained.
- Counters cap at remaining capacity rather than failing at submit.
- A customer type flagged *does not count against capacity* — a lap infant — can
  be added without consuming a seat.
- The receipt is itemised before payment, not after. The booking fee is a line,
  not a surprise.

---

## 2 · An agent takes a booking on the phone

**Try it:** `#/book` — or press `B` from anywhere

Five steps: **Item → Departure → Party → Details → Payment**, with a live order
summary pinned alongside the whole way.

| Difference from the guest flow | Why |
|---|---|
| Online cutoffs do not apply | The agent can sell a 4pm departure at 3:55 |
| Existing contacts are matched and reusable | Repeat callers are recognised |
| Internal note field | "Arriving on the 2:10 ferry, may be five minutes late" |
| Payment can be full, a deposit, or nothing | A balance becomes a task automatically |
| Payment methods include cash, cheque, terminal and invoice | Desk reality |

Writes the same rows as the guest flow, plus a `note` if one was typed, on the
**Dashboard — phone/walk-in** channel with `created_by` set to the agent.

---

## 3 · The morning of the trip

**Try it:** `#/today`, then open any manifest

| Step | Screen | What happens |
|---|---|---|
| 1 | **Today** | Every departure in time order: capacity, crew, check-in progress, flags |
| 2 | Warning strip | Departures with guests but no boat, van or guide are called out by name |
| 3 | **Resources** | Assign the missing craft or guide; clashes are detected |
| 4 | **Manifest** | Names, customer types, waiver state, dietary and height answers, pickup times, balances |
| 5 | Check in | Tick per guest or per booking → `checkin` row, `booking_customer.checked_in_at` |
| 6 | Collect balances | A `payment` against the booking closes it out |

The manifest is the clearest illustration of why the schema is shaped the way it
is. It is a five-table join — `availability` → `booking` → `booking_customer`,
plus `waiver_signature`, `custom_field_value` and `note` — rendered as one list a
guide can read on a phone in the wind.

**Design notes**

- Answers appear inline on the guest row. The guide never taps through to find
  a shellfish allergy.
- Pickup times are computed per lodging from its offset, not typed in.
- A guest with no waiver is red on the row, not hidden behind a tab.

---

## 4 · A guest cancels

**Try it:** open any booking → **More** → **Cancel booking**

| Step | What happens |
|---|---|
| 1 | The item's cancellation policy is looked up |
| 2 | Hours until departure are compared to the free-cancellation window |
| 3 | A refund is proposed: full inside the window, the policy percentage outside it |
| 4 | The agent can override the amount and record a reason |
| 5 | `booking.status` → `cancelled`, `booking.balance` → 0 |
| 6 | Seats return: `availability.booked` decreases, a sold-out slot reopens |
| 7 | A negative `payment` row is written, netted off the next payout |
| 8 | An internal `note` records the reason |

**Nothing is deleted.** A cancelled booking stays in the record with its money
trail intact, because a deleted booking cannot be reconciled, disputed or
reported on.

---

## 5 · Money reaches the bank

**Try it:** `#/payments`, then `#/payouts`

```
booking.total          what the guest owes
  └─ payment           each charge / refund / chargeback, with its fee
       └─ payout       gross − refunds − fees ± adjustments = net paid
```

| Step | Screen | What happens |
|---|---|---|
| 1 | **Payments** | Charges accumulate through the week, each carrying its processing fee |
| 2 | **Payments** filter | *Not yet settled* shows money collected but not yet paid out |
| 3 | **Payouts** | A batch closes for the period and lists every transaction in it |
| 4 | Payout detail | The reconciliation is shown as arithmetic, not a single figure |
| 5 | Status | `scheduled` → `in_transit` → `paid`, three business days after the period |

Every payment in a payout links back to the booking that produced it, so any net
figure can be traced to the seat that generated it.

---

## 6 · A reseller sells a seat

**Try it:** `#/distribution`

| Step | What happens |
|---|---|
| 1 | The affiliate books through their attributed link, or through the API |
| 2 | `booking.affiliate` and `booking.channel` are set |
| 3 | Commission accrues at the affiliate's agreed rate on booking value |
| 4 | Settlement follows the terms: deducted at payout, invoiced monthly, or drawn from a prepaid balance |
| 5 | **Affiliates** shows production, commission owed, and a settle action |

The headline numbers on this screen are **direct share** — the revenue you keep
in full — and **blended take rate** across all commissioned channels. Those two
figures are the whole argument about distribution strategy.

---

## Cross-cutting behaviours

### Waivers

An item flagged *requires waiver* puts every guest on its bookings into a
pending state. The confirmation email carries a signing link; the **Waivers**
section lists everyone outstanding, sorted by how close their departure is, with
bulk reminders. Automated chases stop the moment the waiver is signed, because
the trigger is evaluated against booking state, not fired blindly on a schedule.

Each signature records the signer, the template version they agreed to, the
timestamp and the IP — which is what makes it evidence rather than a checkbox.

### Custom fields

A question is asked either **once per booking** ("emergency contact and phone")
or **once per guest** ("shirt size", "height"). Answers are stored against the
`booking` or the individual `booking_customer` accordingly, and any field flagged
*show on manifest* appears inline on the guide's guest list.

### Messaging

Templates are bound to a trigger and an offset — confirmation immediately, a
reminder 48 hours out, a waiver chase 72 hours out, a review request a day after.
Merge tags resolve per booking at send time. Every send lands in the delivery
log with its outcome, so "did they get it?" is answerable.

### Capacity

One number, `availability.booked`, is the source of truth. It increases when a
booking is created and decreases when one is cancelled or moved. Every capacity
display in the platform — the calendar cell colour, the day board meter, the
manifest ratio, the counter caps in both booking flows — reads that one number
through `domain.capacityState()`.

### Audit

Every write through the data layer appends to `activity_log`: actor, action,
object, detail, timestamp, IP. It is append-only and cannot be edited or deleted
from the dashboard. Clicking around this prototype adds to it.
