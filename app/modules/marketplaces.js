import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, toggle } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast } from '../core/ui/overlay.js';
import { rankBars } from '../core/ui/chart.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'marketplaces',
  title: 'Marketplaces',
  icon: '🌐',
  group: 'Distribution',
  order: 200,
  summary: 'Syndicated listings to Google Things to Do and OTAs, with sync state and errors.',
  entities: ['external_listing', 'item'],

  badge: (ctx) => ctx.db.where('external_listing', l => l.sync_status === 'error').length || null,

  render(ctx) {
    const { db } = ctx;
    const listings = db.all('external_listing');
    const errors = listings.filter(l => l.sync_status === 'error');
    const markets = [...new Set(listings.map(l => l.marketplace))];

    const byMarket = markets.map(m => {
      const rows = listings.filter(l => l.marketplace === m);
      return {
        marketplace: m, listings: rows.length,
        live: rows.filter(r => r.sync_status === 'live').length,
        errors: rows.filter(r => r.sync_status === 'error').length,
        bookings: rows.reduce((s, r) => s + r.bookings_30d, 0),
      };
    }).sort((a, b) => b.bookings - a.bookings);

    const table = dataTable({
      rows: listings,
      exportName: 'marketplace-listings',
      defaultSort: 'bookings_30d', defaultDir: 'desc',
      searchPlaceholder: 'Marketplace or item…',
      onRowClick: (l) => openListing(ctx, l),
      columns: [
        { key: 'marketplace', label: 'Marketplace', render: l => h('span.strong', l.marketplace) },
        { key: 'item', label: 'Item', value: l => db.label('item', l.item) },
        { key: 'external_id', label: 'External ID', render: l => h('span.mono.small', l.external_id) },
        { key: 'sync_status', label: 'Sync', render: l => statusBadge(l.sync_status) },
        { key: 'last_sync', label: 'Last sync', render: l => h('span.small', F.relative(l.last_sync)) },
        { key: 'bookings_30d', label: 'Bookings 30d', align: 'num', fmt: F.num },
        { key: 'last_error', label: 'Last error', render: l => l.last_error
          ? h('span.small', { style: { color: 'var(--danger)' } }, F.truncate(l.last_error, 46)) : h('span.muted', '—') },
      ],
      filters: [
        { key: 'marketplace', label: 'Any marketplace', options: markets.map(m => [m, m]) },
        { key: 'sync_status', label: 'Any sync state', options: ['live', 'syncing', 'error', 'paused'].map(s => [s, F.titleCase(s)]) },
      ],
    });

    return h('div.page',
      pageHead({
        title: 'Marketplaces',
        sub: 'Your inventory listed on someone else’s surface, kept in sync automatically.',
        actions: [btn('Connect a marketplace', { kind: 'primary', icon: '＋', onclick: () => connect(ctx) })],
      }),
      moduleIntro(this, 'A listing maps one of your items to an external product ID. Availability and price are pushed on change; bookings come back as normal bookings on an OTA channel.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Listings', value: F.num(listings.length) }),
        stat({ label: 'Marketplaces connected', value: F.num(markets.length) }),
        stat({ label: 'Bookings (30d)', value: F.num(listings.reduce((s, l) => s + l.bookings_30d, 0)) }),
        stat({ label: 'Sync errors', value: F.num(errors.length), tone: errors.length ? 'danger' : null })),
      errors.length ? h('div.banner.danger.mb-4', h('span', '⚠'),
        h('div', h('div.strong', `${errors.length} listing${errors.length === 1 ? '' : 's'} failing to sync`),
          h('div.small', 'Guests may see stale prices or availability on these listings until they are fixed.')),
        h('div.spacer'),
        btn('Retry all', { size: 'sm', onclick: () => {
          errors.forEach(l => db.update('external_listing', l.pk, { sync_status: 'syncing', last_error: '' }));
          toast('Re-sync queued', { tone: 'ok' });
        } })) : null,
      h('div.grid.side.mb-4',
        card({ title: 'By marketplace', flush: true },
          simpleTable(['Marketplace', { label: 'Listings', align: 'num' }, { label: 'Live', align: 'num' },
                       { label: 'Errors', align: 'num' }, { label: 'Bookings 30d', align: 'num' }],
            byMarket.map(m => [
              h('span.strong', m.marketplace), m.listings,
              badge(String(m.live), 'ok'),
              m.errors ? badge(String(m.errors), 'danger') : h('span.muted', '0'),
              F.num(m.bookings),
            ]))),
        card({ title: 'Bookings by marketplace (30d)' },
          rankBars(byMarket.map(m => ({ label: m.marketplace, value: m.bookings })), { money: false }))),
      card({ flush: true }, table));
  },
};

function openListing(ctx, l) {
  const { db } = ctx;
  drawer({
    title: `${l.marketplace} — ${db.label('item', l.item)}`,
    sub: `External ID ${l.external_id}`,
    badge: statusBadge(l.sync_status),
    render: (api) => h('div.col', { style: { gap: 'var(--sp-4)' } },
      l.last_error ? h('div.banner.danger', h('div', h('div.strong', 'Last sync failed'), h('div.small', l.last_error))) : null,
      card({ title: 'Listing' }, kv([
        ['Marketplace', l.marketplace],
        ['Item', h('a', { href: `#/items/detail/${l.item}` }, db.label('item', l.item))],
        ['External ID', h('span.mono', l.external_id)],
        ['Sync status', statusBadge(l.sync_status)],
        ['Last sync', `${F.relative(l.last_sync)} (${F.dateShort(l.last_sync.slice(0, 10))})`],
        ['Bookings 30d', F.num(l.bookings_30d)],
      ])),
      card({ title: 'What gets pushed' },
        simpleTable(['Field', 'Source', 'Pushed on'], [
          ['Title & description', 'Item name and description', 'Change'],
          ['Price', 'Adult rate for the item', 'Change'],
          ['Availability', 'Open, bookable departures', 'Every 15 minutes and on change'],
          ['Capacity', 'Seats remaining per departure', 'On every booking'],
          ['Cancellation policy', 'Item’s policy', 'Change'],
        ])),
      card({ title: 'Sync controls' },
        h('div.row',
          btn('Re-sync now', { onclick: () => { db.update('external_listing', l.pk, { sync_status: 'syncing', last_error: '', last_sync: new Date().toISOString().slice(0, 19) }); api.refresh(); toast('Sync queued', { tone: 'ok' }); } }),
          btn(l.sync_status === 'paused' ? 'Resume' : 'Pause listing', {
            onclick: () => { db.update('external_listing', l.pk, { sync_status: l.sync_status === 'paused' ? 'live' : 'paused' }); api.refresh(); } })))),
  });
}

function connect(ctx) {
  const { db } = ctx;
  const d = { marketplace: 'Google Things to Do', item: db.all('item')[0]?.pk };
  modal({
    title: 'Connect a marketplace listing',
    render: () => h('div.col',
      h('div.field', h('label', 'Marketplace'),
        select(['Google Things to Do', 'GlobeSeek', 'Coastal Getaways', 'TripBoard'], d.marketplace, v => { d.marketplace = v; })),
      h('div.field', h('label', 'Item to list'),
        select(db.where('item', i => i.status === 'live').map(i => [i.pk, i.name]), d.item, v => { d.item = v; })),
      h('div.banner.info.mt-3', h('div',
        h('div.strong', 'What happens next'),
        h('div.small', 'The item is pushed with its description, adult rate and open departures. First sync usually completes within an hour.')))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Create listing', { kind: 'primary', onclick: () => {
        db.insert('external_listing', {
          company: ctx.domain.company().pk, marketplace: d.marketplace, item: d.item,
          external_id: d.marketplace.slice(0, 2).toUpperCase() + '-' + Math.floor(Math.random() * 900000 + 100000),
          sync_status: 'syncing', last_sync: new Date().toISOString().slice(0, 19),
          last_error: '', bookings_30d: 0,
        });
        api.close(); toast('Listing created', { detail: 'First sync queued', tone: 'ok' });
      } })],
  });
}
