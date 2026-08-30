import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, toggle, tabs, codeBlock, checkbox, meter } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

const EVENTS = [
  'booking.created', 'booking.updated', 'booking.cancelled', 'booking.checked_in',
  'availability.created', 'availability.updated', 'item.updated',
  'payment.succeeded', 'payment.refunded', 'payout.paid',
  'contact.created', 'waiver.signed',
];

const SCOPES = [
  'bookings:read', 'bookings:write', 'availability:read', 'availability:write',
  'items:read', 'items:write', 'contacts:read', 'contacts:write', 'payments:read',
];

const APPS = [
  ['Zapier', 'Automation', 'Connected', 'Pipes booking events into 6,000+ apps.'],
  ['Mailchimp', 'Marketing', 'Connected', 'Syncs opted-in contacts to an audience.'],
  ['Google Analytics 4', 'Analytics', 'Connected', 'Sends purchase events with booking value.'],
  ['Meta Pixel', 'Advertising', 'Connected', 'Attributes bookings back to ad spend.'],
  ['QuickBooks', 'Accounting', 'Not connected', 'Posts daily sales and payout journals.'],
  ['Slack', 'Internal', 'Connected', 'Posts new bookings and failures to a channel.'],
  ['Xero', 'Accounting', 'Not connected', 'Alternative accounting sync.'],
  ['Twilio', 'Messaging', 'Connected', 'Delivers the SMS reminders.'],
];

export default {
  id: 'integrations',
  title: 'Integrations & API',
  icon: '🔌',
  group: 'Admin',
  order: 240,
  summary: 'API keys, webhooks, the external API surface, and the third-party connections.',
  entities: ['api_key', 'webhook'],

  badge: (ctx) => ctx.db.where('webhook', w => w.status === 'failing').length || null,

  render(ctx) {
    const { db, router, route } = ctx;
    const tab = route.query.tab || 'apps';
    const keys = db.all('api_key');
    const hooks = db.all('webhook');
    const failing = hooks.filter(w => w.status === 'failing');
    const shortname = ctx.domain.company()?.shortname;

    const TABS = [
      { id: 'apps', title: 'Connected apps', count: APPS.filter(a => a[2] === 'Connected').length },
      { id: 'keys', title: 'API keys', count: keys.length },
      { id: 'webhooks', title: 'Webhooks', count: hooks.length },
      { id: 'api', title: 'API reference' },
    ];

    const panes = {
      apps: () => h('div.grid.c3', ...APPS.map(([name, cat, status, desc]) => card({},
        h('div.row.mb-3',
          h('div', { style: { width: '34px', height: '34px', borderRadius: 'var(--r-md)', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeContent: 'center', fontWeight: 700 } },
            name.slice(0, 2).toUpperCase()),
          h('div', { style: { flex: 1 } }, h('div.strong', name), h('div.small.muted', cat)),
          status === 'Connected' ? badge('Connected', 'ok', true) : badge('Off', '', true)),
        h('div.small.muted', desc),
        h('div.mt-3', btn(status === 'Connected' ? 'Configure' : 'Connect', {
          size: 'sm', kind: status === 'Connected' ? '' : 'primary', block: true,
          onclick: () => toast(`${name} — ${status === 'Connected' ? 'settings' : 'OAuth flow'}`, { detail: 'Prototype stub', tone: 'warn' }),
        }))))),

      keys: () => card({ title: 'API keys', sub: 'Scoped credentials for the external API', flush: true,
        actions: [btn('Create key', { size: 'sm', kind: 'primary', onclick: () => createKey(ctx) })] },
        simpleTable(['Label', 'Key', 'Scopes', 'Created', 'Last used', { label: 'Requests 30d', align: 'num' }, 'Status', ''],
          keys.map(k => [
            h('span.strong', k.name),
            h('span.mono.small', `${k.key_prefix}••••••••`),
            h('div.row', { style: { gap: '3px' } }, ...k.scopes.map(s => badge(s))),
            F.dateShort(k.created_at.slice(0, 10)),
            h('span.small', F.relative(k.last_used)),
            F.num(k.requests_30d),
            statusBadge(k.status),
            k.status === 'active' ? btn('Revoke', { size: 'sm', kind: 'ghost', onclick: () => confirm({
              title: `Revoke ${k.name}?`, body: 'Any system using this key stops working immediately.',
              confirmLabel: 'Revoke', tone: 'danger',
              onConfirm: () => { db.update('api_key', k.pk, { status: 'revoked' }); toast('Key revoked', { tone: 'ok' }); },
            }) }) : '',
          ]))),

      webhooks: () => h('div.col',
        failing.length ? h('div.banner.danger', h('span', '⚠'),
          h('div', h('div.strong', `${failing.length} endpoint${failing.length === 1 ? '' : 's'} failing`),
            h('div.small', 'Deliveries retry with exponential backoff for 24 hours, then drop.'))) : null,
        card({ title: 'Webhook endpoints', flush: true,
          actions: [btn('Add endpoint', { size: 'sm', kind: 'primary', onclick: () => editHook(ctx, null) })] },
          simpleTable(['Endpoint', 'Events', { label: 'Success rate', align: 'num' }, 'Last delivery', { label: 'Failures 24h', align: 'num' }, 'Status', ''],
            hooks.map(w => [
              h('span.mono.small', w.url),
              h('div.row', { style: { gap: '3px' } }, ...w.events.map(e => badge(e))),
              h('div', { style: { minWidth: '90px' } },
                h('div.small.right', F.pct(w.success_rate, 1)),
                meter(w.success_rate * 100, 100, w.success_rate > 0.95 ? 'ok' : 'danger')),
              h('span.small', F.relative(w.last_delivery)),
              w.failures_24h ? h('span.strong', { style: { color: 'var(--danger)' } }, F.num(w.failures_24h)) : '0',
              statusBadge(w.status),
              h('div.row', { style: { gap: '4px' } },
                btn('Test', { size: 'sm', onclick: () => testHook(ctx, w) }),
                btn('Edit', { size: 'sm', onclick: () => editHook(ctx, w) })),
            ]))),
        card({ title: 'Example payload', sub: 'booking.created' },
          codeBlock(JSON.stringify(samplePayload(ctx), null, 2)))),

      api: () => h('div.col',
        card({ title: 'External API', sub: 'REST over HTTPS, JSON in and out' },
          kv([
            ['Base URL', h('span.mono', `https://fareharbor.com/api/external/v1/companies/${shortname}/`)],
            ['Authentication', h('span.mono', 'X-FareHarbor-API-App / X-FareHarbor-API-User headers')],
            ['Rate limit', '600 requests per minute per key'],
            ['Pagination', h('span.mono', '?page=1&per_page=100')],
            ['Errors', 'RFC 7807 problem documents with a machine-readable code'],
          ])),
        card({ title: 'Endpoints', flush: true },
          simpleTable(['Method', 'Path', 'Returns'], [
            ['GET', `/companies/${shortname}/items/`, 'Every item in the catalog'],
            ['GET', `/companies/${shortname}/items/{id}/`, 'One item with its customer type rates'],
            ['GET', `/companies/${shortname}/items/{id}/minimal/availabilities/date/{date}/`, 'Departures on a date'],
            ['GET', `/companies/${shortname}/availabilities/{id}/`, 'One departure with seats remaining'],
            ['POST', `/companies/${shortname}/availabilities/{id}/bookings/`, 'Creates a booking'],
            ['GET', `/companies/${shortname}/bookings/{uuid}/`, 'One booking with customers and payments'],
            ['PUT', `/companies/${shortname}/bookings/{uuid}/`, 'Updates customers or custom field answers'],
            ['DELETE', `/companies/${shortname}/bookings/{uuid}/`, 'Cancels a booking'],
            ['GET', `/companies/${shortname}/contacts/`, 'Contact records'],
            ['GET', `/companies/${shortname}/lodgings/`, 'Pickup lodging list'],
            ['GET', `/companies/${shortname}/custom-fields/`, 'Custom field definitions'],
          ].map(r => [badge(r[0], r[0] === 'GET' ? 'info' : r[0] === 'DELETE' ? 'danger' : 'ok'), h('span.mono.small', r[1]), r[2]]))),
        card({ title: 'Creating a booking', sub: 'The one call most partners care about' },
          codeBlock(`POST /api/external/v1/companies/${shortname}/availabilities/{availability_pk}/bookings/

{
  "contact": {
    "name":  "Maya Okafor",
    "email": "maya@example.com",
    "phone": "+15035550142"
  },
  "customers": [
    { "customer_type_rate": 41201 },
    { "customer_type_rate": 41201 },
    { "customer_type_rate": 41202 }
  ],
  "custom_field_values": [
    { "custom_field": 8814, "value": "Shellfish allergy" }
  ],
  "voucher_number": "PARTNER-88213"
}

201 Created
{
  "booking": {
    "pk": 9001422,
    "uuid": "b3f1c0d2-...",
    "display_id": "FH-60001",
    "status": "confirmed",
    "amount_paid": 0,
    "receipt_total": "271.40",
    "customers": [ ... ]
  }
}`))),
    };

    return h('div.page',
      pageHead({
        title: 'Integrations & API',
        sub: 'How other systems read from and write to your account.',
      }),
      moduleIntro(this, 'Three surfaces: connected apps (managed OAuth), API keys (you pull), and webhooks (we push). Everything a partner can do through the API is something a user can do in the dashboard, subject to the key’s scopes.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Active API keys', value: F.num(keys.filter(k => k.status === 'active').length) }),
        stat({ label: 'API requests (30d)', value: F.num(keys.reduce((s, k) => s + k.requests_30d, 0)) }),
        stat({ label: 'Webhook endpoints', value: F.num(hooks.length) }),
        stat({ label: 'Failing endpoints', value: F.num(failing.length), tone: failing.length ? 'danger' : null })),
      tabs(TABS, tab, id => router.patchQuery({ tab: id })),
      h('div.mt-4', panes[tab]()));
  },
};

function samplePayload(ctx) {
  const { db } = ctx;
  const b = db.all('booking').slice(-1)[0];
  const av = db.get('availability', b?.availability);
  const c = db.get('contact', b?.contact);
  return {
    event: 'booking.created',
    sent_at: new Date().toISOString(),
    company: ctx.domain.company()?.shortname,
    data: {
      booking: {
        display_id: b?.code,
        status: b?.status,
        pax: b?.pax,
        receipt_total: ((b?.total || 0) / 100).toFixed(2),
        amount_paid: ((b?.paid || 0) / 100).toFixed(2),
        item: { name: db.label('item', b?.item) },
        availability: { start_at: av ? `${av.date}T${av.start_time}:00` : null, capacity: av?.capacity },
        contact: { name: c?.name, email: c?.email },
      },
    },
  };
}

function testHook(ctx, w) {
  modal({
    title: 'Test delivery',
    sub: w.url,
    width: 'wide',
    render: () => h('div.col',
      h('div.banner.ok', h('div', h('div.strong', '200 OK'), h('div.small', 'Round trip 184 ms'))),
      h('div.small.strong.mt-3', 'Request body'),
      codeBlock(JSON.stringify(samplePayload(ctx), null, 2))),
  });
}

function createKey(ctx) {
  const { db } = ctx;
  const d = { name: '', scopes: ['bookings:read', 'availability:read'] };
  modal({
    title: 'Create an API key',
    sub: 'The secret is shown once. Store it somewhere safe.',
    render: () => h('div.col',
      h('div.field', h('label', 'Label'),
        h('input.input', { placeholder: 'Partner integration — Acme', oninput: e => { d.name = e.target.value; } })),
      h('div.field.mt-3', h('label', 'Scopes'),
        h('div.grid.c2', ...SCOPES.map(s => checkbox(s, d.scopes.includes(s), v => {
          d.scopes = v ? [...d.scopes, s] : d.scopes.filter(x => x !== s);
        }))))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Create key', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Label the key', { tone: 'warn' });
        const prefix = 'fh_live_' + Math.random().toString(36).slice(2, 10);
        db.insert('api_key', { company: ctx.domain.company().pk, name: d.name, key_prefix: prefix,
          scopes: d.scopes, created_at: new Date().toISOString().slice(0, 19),
          last_used: new Date().toISOString().slice(0, 19), requests_30d: 0, status: 'active' });
        api.close();
        modal({ title: 'Key created', sub: 'This is the only time the full key is shown.',
          render: () => h('div', codeBlock(prefix + Math.random().toString(36).slice(2, 26)),
            h('div.mt-3', h('div.banner.warn', h('div', h('div.strong', 'Copy it now'),
              h('div.small', 'FareHarbor stores only a hash. If you lose it, revoke the key and create another.'))))) });
      } })],
  });
}

function editHook(ctx, w) {
  const { db } = ctx;
  const d = w ? { ...w, events: [...w.events] } : { url: '', events: ['booking.created'], status: 'active', success_rate: 1, failures_24h: 0 };
  modal({
    title: w ? 'Edit endpoint' : 'Add webhook endpoint',
    width: 'wide',
    render: () => h('div.col',
      h('div.field', h('label', 'Endpoint URL'),
        h('input.input', { value: d.url, placeholder: 'https://example.com/hooks/fareharbor', oninput: e => { d.url = e.target.value; } })),
      h('div.field.mt-3', h('label', 'Events to send'),
        h('div.grid.c3', ...EVENTS.map(ev => checkbox(ev, d.events.includes(ev), v => {
          d.events = v ? [...d.events, ev] : d.events.filter(x => x !== ev);
        }))))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Save endpoint', { kind: 'primary', onclick: () => {
        if (!d.url.trim()) return toast('Enter a URL', { tone: 'warn' });
        if (w) db.update('webhook', w.pk, d);
        else db.insert('webhook', { company: ctx.domain.company().pk, ...d, last_delivery: new Date().toISOString().slice(0, 19) });
        api.close(); toast('Endpoint saved', { tone: 'ok' });
      } })],
  });
}
