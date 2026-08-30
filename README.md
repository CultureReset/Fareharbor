# FareHarbor — Platform Map & Working Prototype

A complete, navigable map of the FareHarbor operator platform: what it is, every
section it contains, how the sections relate, and a working prototype of all of
them running against one shared data model.

**Open `index.html` in a browser.** No build step, no install, no server
required. It is plain ES modules and CSS.

```bash
git clone https://github.com/CultureReset/Fareharbor
cd Fareharbor
python3 -m http.server 8000     # or: npx serve .  — any static server
# then open http://localhost:8000
```

(Opening the file directly with `file://` will not work — ES modules need an
origin. Any static server does.)

---

## What this is

FareHarbor is booking and management software for tour, activity, attraction and
rental operators. This repository maps the whole platform two ways:

1. **A working prototype** — 29 sections, all functional, all reading and
   writing the same in-memory database of 41 tables and roughly 52,000 rows.
2. **Written documentation** — [`docs/`](docs/), plus a **Platform Map** section
   inside the app itself that explains the system while you are looking at it.

Nothing is a static mockup. The two booking flows genuinely create bookings; the
calendar genuinely decrements capacity; the reports genuinely recompute.

---

## Start here

| If you want to… | Go to |
|---|---|
| Understand the platform in ten minutes | **Platform Map** in the app (`#/guide`) |
| See the operator's daily view | **Home** and **Today** |
| See every table and how they join | **Data Model** (`#/datamodel`) |
| Watch a booking get created | **Guest Storefront** (`#/storefront`) |
| Take a booking as an agent would | **New Booking** (`#/book`) |
| See how a section is built | [`app/modules/bookings.js`](app/modules/bookings.js) |
| Add your own section | [`docs/MODULE-GUIDE.md`](docs/MODULE-GUIDE.md) |

### Documentation

| Document | Covers |
|---|---|
| [`docs/PLATFORM-MAP.md`](docs/PLATFORM-MAP.md) | The full scope: what FareHarbor is, the information architecture, every section's UI and UX, the design system, and the principles behind it |
| [`docs/UX-FLOWS.md`](docs/UX-FLOWS.md) | Six journeys end to end, with the screens involved and the rows each one writes |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Every table and field, generated from the schema so it cannot drift |
| [`docs/MODULE-GUIDE.md`](docs/MODULE-GUIDE.md) | How to add a section, a table, a report or a column |

---

## The sections

**Overview** — Home · Today · Tasks
**Operations** — Bookings · Calendar · Check-in & Manifests · Resources
**Catalog** — Items · Pricing & Promos · Custom Fields · Waivers
**Guests** — Contacts · Messaging · Gift Cards · Memberships
**Money** — Payments · Payouts
**Distribution** — Affiliates & Channels · Book Buttons · Marketplaces
**Insights** — Reports
**Admin** — Users & Roles · Settings · Integrations & API · Activity Log
**Reference** — Data Model · Platform Map · New Booking · Guest Storefront

Each is one file in [`app/modules/`](app/modules/). Each declares its own
sidebar entry, routes, search contributions and command-palette verbs.

---

## The one sentence that explains the data model

> An **item** is a product; it generates dated **availability** rows; a guest
> books one, producing a **booking** that holds a **booking_customer** per seat
> and a **payment** per transaction; payments settle in a **payout**.

Almost every screen is a different view onto that chain. The calendar is
availabilities by date. A manifest is one availability joined to its bookings
and their customers. A report is that chain grouped and totalled.

Full detail: [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) and the in-app Data
Model explorer, both generated from [`app/data/schema.js`](app/data/schema.js).

---

## Architecture

```
index.html                  Entry point. Loads three stylesheets and one module.
styles/
  tokens.css                Design tokens. Change these to re-skin everything.
  base.css                  Reset, app shell grid, sidebar, page scaffolding.
  components.css            The component library.
app/
  main.js                   Composition root. The MODULES array is the only
                            place that knows which sections exist.
  core/
    dom.js                  h() hyperscript. Returns real DOM nodes.
    store.js                Reactive store + pub/sub bus.
    router.js               Hash router. Every filter and tab lives in the URL.
    registry.js             The modularity seam — see below.
    format.js               Money, dates, durations, relative times.
    ui/
      shell.js              Top bar, sidebar, global search, command palette.
      kit.js                Cards, buttons, badges, stats, tabs, forms, tables.
      table.js              DataTable: sort, search, filter, page, select,
                            bulk actions, CSV export.
      overlay.js            Drawers, modals, menus, toasts, confirms.
      chart.js              Sparkline, bar, ranked bar, donut, heatmap — SVG,
                            no library.
  data/
    schema.js               41 tables declared once, with types and relations.
    seed.js                 Deterministic generator. Same seed, same data.
    db.js                   query / get / rel / children / groupBy, plus writes
                            that append to the audit log.
    domain.js               Business rules: pricing, capacity, refunds,
                            manifests, metrics.
  modules/
    _shared.js              The booking detail panel and cross-section helpers.
    *.js                    One file per section.
docs/                       The written map.
```

### What "modular" means here

- **Nothing in the shell names a section.** The sidebar, router, global search
  and command palette are all derived from the registry. Removing a section is
  removing one import line from `app/main.js`.
- **Every list is the same component.** `dataTable()` takes column definitions;
  sorting, searching, filtering, pagination, selection, bulk actions and CSV
  export come for free.
- **Every report is the same engine.** Datasets, dimensions and measures are
  declared in a table at the top of `reports.js`. Adding a report is adding a
  row, not writing a screen.
- **Business rules are not in the UI.** A screen never computes a price or
  decides whether a departure is full. It asks `domain.js`.
- **The data layer is swappable.** Modules call `db.query()`, never a raw array.
  Pointing this at a real API means changing one file.

---

## Where to change things

| To change… | Edit |
|---|---|
| Colours, spacing, typography | `styles/tokens.css` |
| A table or a field | `app/data/schema.js` |
| How much demo data, and of what shape | `app/data/seed.js` |
| A pricing, capacity or refund rule | `app/data/domain.js` |
| What a list column shows | the `columns` array in that section |
| Which sections exist | the `MODULES` array in `app/main.js` |
| The demo company, items and staff | the vocab blocks at the top of `seed.js` |

---

## Keyboard

| Key | Does |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette — every section and quick action |
| `/` | Focus the global search box |
| `B` | Start a new booking |
| `T` | Toggle light and dark |
| `\` | Collapse the sidebar |
| `G` then `H` `B` `C` `I` `R` `T` | Home, Bookings, Calendar, Items, Reports, Today |
| `Esc` | Close the top drawer, modal or menu |

---

## Notes on the data

The dataset is generated at load from a fixed seed, so it is identical on every
reload and every link is stable. It reconciles: booking totals equal the sum of
their customers plus taxes minus discounts; payouts equal the payments they
contain; `availability.booked` equals the guests actually booked onto it.

Changes you make in the browser are held in memory only — reload to reset, or
use **Settings → Data & retention → Regenerate demo data** for a different
random dataset. Nothing is written to disk and nothing leaves the browser.

The company, staff, items and guests are invented. `docs/` describes FareHarbor
the platform; the operator in the prototype is fictional.
