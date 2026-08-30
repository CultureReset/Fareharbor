import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, toggle, tabs, kv, codeBlock } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast } from '../core/ui/overlay.js';
import { donut, legend, rankBars } from '../core/ui/chart.js';
import { openBooking, moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

const TRIGGERS = [
  ['booking_confirmed', 'Immediately after booking'],
  ['reminder_48h', '48 hours before departure'],
  ['reminder_24h', '24 hours before departure'],
  ['waiver_request', 'When a waiver is outstanding'],
  ['balance_due', 'When a balance is outstanding'],
  ['cancelled', 'When a booking is cancelled'],
  ['post_trip', 'After the trip ends'],
  ['manual', 'Only when sent by hand'],
];

const MERGE_TAGS = [
  ['{{first_name}}', 'Lead guest first name'], ['{{code}}', 'Confirmation number'],
  ['{{item_name}}', 'Item booked'], ['{{date}}', 'Departure date'], ['{{time}}', 'Departure time'],
  ['{{meeting_point}}', 'Location name and address'], ['{{balance}}', 'Amount still owed'],
  ['{{waiver_link}}', 'One-time waiver signing link'], ['{{company_name}}', 'Your company name'],
  ['{{manage_link}}', 'Guest self-service link'],
];

export default {
  id: 'messaging',
  title: 'Messaging',
  icon: '✉',
  group: 'Guests',
  order: 130,
  summary: 'Automated confirmations, reminders and chases, plus the delivery log for every message sent.',
  entities: ['message_template', 'message_log'],

  render(ctx) {
    const { db, router, route } = ctx;
    const tab = route.query.tab || 'templates';
    const templates = db.all('message_template');
    const logs = db.all('message_log');

    const delivered = logs.filter(l => ['delivered', 'opened'].includes(l.status));
    const opened = logs.filter(l => l.status === 'opened');
    const failed = logs.filter(l => ['bounced', 'failed'].includes(l.status));
    const byStatus = db.groupBy(logs, l => F.titleCase(l.status), {}).map(g => ({ label: g.key, value: g.count }));

    const TABS = [
      { id: 'templates', title: 'Templates', count: templates.length },
      { id: 'log', title: 'Delivery log', count: logs.length },
      { id: 'tags', title: 'Merge tags' },
    ];

    const panes = {
      templates: () => h('div.grid.c2', ...templates.map(t => card({
        title: t.name,
        sub: TRIGGERS.find(x => x[0] === t.trigger)?.[1],
        actions: [toggle(t.is_active, v => db.update('message_template', t.pk, { is_active: v }))],
      },
        h('div.row.mb-3', badge(F.titleCase(t.medium), t.medium === 'sms' ? 'purple' : 'info'),
          t.offset_hours ? badge(t.offset_hours < 0 ? `${Math.abs(t.offset_hours)}h before` : `${t.offset_hours}h after`, 'warn') : badge('Immediate'),
          h('div.spacer'),
          h('span.small.muted', `${F.num(logs.filter(l => l.template === t.pk).length)} sent`)),
        t.subject ? h('div.small.mb-2', h('span.muted', 'Subject: '), h('span.strong', t.subject)) : null,
        h('div.small.muted', { style: { whiteSpace: 'pre-wrap', maxHeight: '92px', overflow: 'hidden' } }, t.body),
        h('div.row.mt-3',
          btn('Edit', { size: 'sm', onclick: () => editTemplate(ctx, t) }),
          btn('Preview', { size: 'sm', onclick: () => previewTemplate(ctx, t) })))),
        card({ title: 'Add a template' },
          h('p.small.muted', 'Every automated message a guest receives is one of these. Turning one off stops that message immediately.'),
          h('div.mt-3', btn('New template', { kind: 'primary', onclick: () => editTemplate(ctx, null) })))),

      log: () => card({ flush: true }, dataTable({
        rows: logs,
        exportName: 'message-log',
        defaultSort: 'sent_at', defaultDir: 'desc',
        searchPlaceholder: 'Recipient or subject…',
        onRowClick: (l) => l.booking && openBooking(ctx, l.booking),
        columns: [
          { key: 'sent_at', label: 'Sent', render: l => h('div',
            h('div', F.dateShort(l.sent_at.slice(0, 10))), h('div.small.muted', F.relative(l.sent_at))) },
          { key: 'template', label: 'Template', value: l => db.label('message_template', l.template) },
          { key: 'medium', label: 'Channel', render: l => badge(F.titleCase(l.medium), l.medium === 'sms' ? 'purple' : 'info') },
          { key: 'to', label: 'Recipient', render: l => h('span.small', l.to) },
          { key: 'subject', label: 'Subject', render: l => h('span.small', F.truncate(l.subject, 46) || '—') },
          { key: 'booking', label: 'Booking', value: l => db.label('booking', l.booking),
            render: l => h('span.mono.small', db.label('booking', l.booking)) },
          { key: 'status', label: 'Status', render: l => statusBadge(l.status) },
        ],
        filters: [
          { key: 'status', label: 'Any status', options: ['delivered', 'opened', 'sent', 'bounced', 'failed'].map(s => [s, F.titleCase(s)]) },
          { key: 'medium', label: 'Any channel', options: [['email', 'Email'], ['sms', 'SMS']] },
          { key: 'template', label: 'Any template', options: templates.map(t => [t.pk, t.name]) },
        ],
      })),

      tags: () => h('div.grid.side',
        card({ title: 'Merge tags', sub: 'Drop these into a subject or body; they resolve per booking at send time.', flush: true },
          simpleTable(['Tag', 'Resolves to'], MERGE_TAGS.map(([tag, desc]) => [h('span.mono.strong', tag), desc]))),
        card({ title: 'Rendered example' },
          h('p.small.muted', 'Using the most recent booking:'),
          (() => {
            const b = db.all('booking').slice(-1)[0];
            const av = db.get('availability', b?.availability);
            return codeBlock(render(db.all('message_template')[0]?.body || '', ctx, b));
          })())),
    };

    return h('div.page',
      pageHead({
        title: 'Messaging',
        sub: 'Everything the platform sends a guest on your behalf.',
        actions: [btn('New template', { kind: 'primary', icon: '＋', onclick: () => editTemplate(ctx, null) })],
      }),
      moduleIntro(this, 'Templates are bound to a trigger and an offset. The scheduler evaluates them against booking state, so a waiver chase stops firing the moment the waiver is signed.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Messages sent', value: F.num(logs.length) }),
        stat({ label: 'Delivered', value: F.pct(logs.length ? delivered.length / logs.length : 0, 1) }),
        stat({ label: 'Opened', value: F.pct(delivered.length ? opened.length / delivered.length : 0, 1) }),
        stat({ label: 'Bounced or failed', value: F.num(failed.length), tone: failed.length ? 'danger' : null })),
      h('div.grid.side.mb-4',
        card({ title: 'Active automations', flush: true },
          simpleTable(['Template', 'Fires', 'Channel', 'Sent', 'Live'],
            templates.map(t => [
              h('span.strong', t.name),
              h('span.small', TRIGGERS.find(x => x[0] === t.trigger)?.[1]),
              badge(F.titleCase(t.medium), t.medium === 'sms' ? 'purple' : 'info'),
              F.num(logs.filter(l => l.template === t.pk).length),
              t.is_active ? badge('On', 'ok', true) : badge('Off', '', true),
            ]))),
        card({ title: 'Delivery outcomes' },
          h('div.row', { style: { gap: '16px', alignItems: 'center' } },
            donut(byStatus, { centerLabel: F.num(logs.length), centerSub: 'messages' }),
            h('div', { style: { flex: 1 } }, legend(byStatus))))),
      tabs(TABS, tab, id => router.patchQuery({ tab: id })),
      h('div.mt-4', panes[tab]()));
  },
};

function render(body, ctx, b) {
  const { db } = ctx;
  if (!b) return body;
  const av = db.get('availability', b.availability);
  const c = db.get('contact', b.contact);
  const item = db.get('item', b.item);
  const map = {
    '{{first_name}}': (c?.name || '').split(' ')[0],
    '{{code}}': b.code,
    '{{item_name}}': item?.name,
    '{{date}}': av ? F.dateLong(av.date) : '',
    '{{time}}': av ? F.time12(av.start_time) : '',
    '{{meeting_point}}': db.label('location', item?.location),
    '{{balance}}': F.money(b.balance),
    '{{company_name}}': ctx.domain.company()?.name,
    '{{waiver_link}}': 'https://fareharbor.com/w/' + b.code.toLowerCase(),
    '{{manage_link}}': 'https://fareharbor.com/m/' + b.code.toLowerCase(),
  };
  return body.replace(/\{\{\w+\}\}/g, (m) => map[m] ?? m);
}

function previewTemplate(ctx, t) {
  const b = ctx.db.all('booking').slice(-1)[0];
  modal({
    title: `Preview — ${t.name}`,
    sub: `Rendered against ${b?.code}`,
    width: 'wide',
    render: () => t.medium === 'sms'
      ? h('div', { style: { maxWidth: '320px', margin: '0 auto', background: 'var(--surface-3)', borderRadius: '18px', padding: '14px' } },
          h('div', { style: { background: 'var(--primary)', color: '#fff', borderRadius: '14px', padding: '10px 13px', fontSize: '13px', whiteSpace: 'pre-wrap' } },
            render(t.body, ctx, b)))
      : h('div', { style: { border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' } },
          h('div', { style: { padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' } },
            h('div.small.muted', 'Subject'), h('div.strong', render(t.subject, ctx, b))),
          h('div', { style: { background: 'var(--brand-navy)', color: '#fff', padding: '16px' } },
            h('div.strong', ctx.domain.company()?.name)),
          h('div', { style: { padding: '18px', whiteSpace: 'pre-wrap', fontSize: '14px' } }, render(t.body, ctx, b)),
          h('div', { style: { padding: '12px 18px', background: 'var(--surface-2)', fontSize: '11px', color: 'var(--fg-muted)' } },
            `${ctx.domain.company()?.address} · Manage your booking · Unsubscribe`)),
  });
}

function editTemplate(ctx, t) {
  const { db } = ctx;
  const d = t ? { ...t } : { name: '', trigger: 'manual', medium: 'email', subject: '', body: '', offset_hours: 0, is_active: true };
  modal({
    title: t ? `Edit ${t.name}` : 'New message template',
    width: 'wide',
    render: (api) => h('div.col',
      h('div.grid.c2',
        h('div.field', h('label', 'Template name'), h('input.input', { value: d.name, oninput: e => { d.name = e.target.value; } })),
        h('div.field', h('label', 'Channel'), select([['email', 'Email'], ['sms', 'SMS']], d.medium, v => { d.medium = v; api.refresh(); })),
        h('div.field', h('label', 'Trigger'), select(TRIGGERS, d.trigger, v => { d.trigger = v; })),
        h('div.field', h('label', 'Offset (hours; negative = before departure)'),
          h('input.input', { type: 'number', value: d.offset_hours, oninput: e => { d.offset_hours = Number(e.target.value); } }))),
      d.medium === 'email' ? h('div.field.mt-3', h('label', 'Subject'),
        h('input.input', { value: d.subject, oninput: e => { d.subject = e.target.value; } })) : null,
      h('div.field.mt-3', h('label', 'Body'),
        h('textarea.textarea', { style: 'min-height:190px', value: d.body, oninput: e => { d.body = e.target.value; } }),
        h('div.hint', 'Merge tags: ' + MERGE_TAGS.slice(0, 6).map(x => x[0]).join(' ')))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn(t ? 'Save' : 'Create template', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name the template', { tone: 'warn' });
        if (t) db.update('message_template', t.pk, d);
        else db.insert('message_template', { company: ctx.domain.company().pk, ...d });
        api.close(); toast('Saved', { tone: 'ok' });
      } })],
  });
}
