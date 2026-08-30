/**
 * main.js — composition root.
 *
 * This file wires the pieces together and lists the sections. It is the only
 * place that knows which modules exist; everything else discovers them through
 * the registry. Deleting a line from MODULES removes a section cleanly.
 */
import { h, mount } from './core/dom.js';
import { createStore, persisted, persist } from './core/store.js';
import { createRouter } from './core/router.js';
import { createRegistry } from './core/registry.js';
import { createDb } from './data/db.js';
import { createDomain } from './data/domain.js';
import { buildShell } from './core/ui/shell.js';
import { closeAll } from './core/ui/overlay.js';
import { today, addDays } from './core/format.js';

/* ------------------------------------------------------------ sections */
import home        from './modules/home.js';
import todayMod    from './modules/today.js';
import tasks       from './modules/tasks.js';
import bookings    from './modules/bookings.js';
import calendar    from './modules/calendar.js';
import checkin     from './modules/checkin.js';
import resources   from './modules/resources.js';
import items       from './modules/items.js';
import customfields from './modules/customfields.js';
import waivers     from './modules/waivers.js';
import contacts    from './modules/contacts.js';
import messaging   from './modules/messaging.js';
import giftcards   from './modules/giftcards.js';
import memberships from './modules/memberships.js';
import payments    from './modules/payments.js';
import payouts     from './modules/payouts.js';
import pricing     from './modules/pricing.js';
import distribution from './modules/distribution.js';
import widgets     from './modules/widgets.js';
import marketplaces from './modules/marketplaces.js';
import reports     from './modules/reports.js';
import users       from './modules/users.js';
import settings    from './modules/settings.js';
import integrations from './modules/integrations.js';
import activity    from './modules/activity.js';
import datamodel   from './modules/datamodel.js';
import guide       from './modules/guide.js';
import book        from './modules/book.js';
import storefront  from './modules/storefront.js';

const MODULES = [
  home, todayMod, tasks,
  bookings, calendar, checkin, resources,
  items, pricing, customfields, waivers,
  contacts, messaging, giftcards, memberships,
  payments, payouts,
  distribution, widgets, marketplaces,
  reports,
  users, settings, integrations, activity,
  datamodel, guide,
  book, storefront,
];

/* ---------------------------------------------------------------- boot */
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
const store = createStore({
  theme: persisted('fh.theme', prefersDark ? 'dark' : 'light'),
  sidebarCollapsed: persisted('fh.sidebarCollapsed', false),
  currentUser: null,
  dateRange: { from: addDays(today(), -29), to: today() },
});
document.documentElement.dataset.theme = store.get('theme');

const db = createDb(store);
store.set({ currentUser: db.all('user')[0] });

const domain = createDomain(db, store);
const registry = createRegistry().registerAll(MODULES);

const router = createRouter(handleRoute);
const ctx = { db, store, domain, registry, router, go: (p, q) => router.go(p, q) };
const shell = buildShell(ctx);

document.getElementById('root').replaceChildren(shell.root);
shell.render();

function handleRoute(route, isPatch) {
  ctx.route = route;
  if (!isPatch) closeAll();
  const mod = registry.get(route.module) || registry.get('home');
  shell.refreshNav();
  try {
    mount(shell.main, mod.render(ctx));
  } catch (err) {
    console.error(err);
    mount(shell.main, h('div.page',
      h('div.banner.danger',
        h('div', h('div.strong', `Could not render “${mod.title}”`),
          h('pre.small', { style: { whiteSpace: 'pre-wrap', margin: '8px 0 0' } }, String(err.stack || err))))));
  }
  if (!isPatch) shell.main.scrollTop = 0;
}

/* Re-render the current screen whenever data changes underneath it. */
let pending = null;
store.on('db:change', () => {
  clearTimeout(pending);
  pending = setTimeout(() => handleRoute(router.current, true), 60);
});
store.on('db:reset', () => handleRoute(router.current));

router.start();

// Expose for console tinkering — this is a prototype, poking at it is the point.
window.FH = { ...ctx, shell, MODULES };
