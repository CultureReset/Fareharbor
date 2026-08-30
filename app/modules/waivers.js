import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, toggle, kv, meter, tabs } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { openBooking, moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'waivers',
  title: 'Waivers',
  icon: '✍',
  group: 'Catalog',
  order: 110,
  summary: 'Waiver templates, minor policies, and the signature record behind every guest.',
  entities: ['waiver_template', 'waiver_signature', 'booking_customer'],

  badge: (ctx) => ctx.domain.missingWaivers().length || null,

  render(ctx) {
    const { db, domain, router, route } = ctx;
    const tab = route.query.tab || 'outstanding';
    const templates = db.all('waiver_template');
    const sigs = db.all('waiver_signature');
    const outstanding = domain.missingWaivers();
    const upcoming = outstanding.filter(b => {
      const a = db.get('availability', b.availability);
      return a && a.date >= F.today();
    });
    const requiredItems = db.where('item', i => i.requires_waiver && i.status === 'live');

    const TABS = [
      { id: 'outstanding', title: 'Outstanding', count: outstanding.length },
      { id: 'signatures', title: 'Signatures', count: sigs.length },
      { id: 'templates', title: 'Templates', count: templates.length },
    ];

    const panes = {
      outstanding: () => card({ flush: true }, dataTable({
        rows: outstanding,
        exportName: 'waivers-outstanding',
        searchPlaceholder: 'Confirmation # or guest…',
        defaultSort: 'departure',
        onRowClick: (b) => openBooking(ctx, b),
        columns: [
          { key: 'code', label: 'Confirmation', render: b => h('span.mono.strong', b.code) },
          { key: 'contact', label: 'Guest', value: b => db.label('contact', b.contact),
            render: b => h('div', h('div.strong', db.label('contact', b.contact)),
              h('div.small.muted', db.get('contact', b.contact)?.email)) },
          { key: 'item', label: 'Item', value: b => db.label('item', b.item) },
          { key: 'departure', label: 'Departure',
            value: b => db.get('availability', b.availability)?.date || '',
            render: b => { const a = db.get('availability', b.availability);
              if (!a) return '—';
              const days = F.diffDays(F.today(), a.date);
              return h('div', h('div', F.dateShort(a.date)),
                h('div.small', { style: { color: days <= 2 && days >= 0 ? 'var(--danger)' : 'var(--fg-muted)' } },
                  days < 0 ? 'past' : days === 0 ? 'today' : `in ${days} days`)); } },
          { key: 'pax', label: 'Guests', align: 'num' },
          { key: 'signed', label: 'Signed', align: 'num',
            value: b => db.children('booking_customer', 'booking', b.pk).filter(c => c.waiver_signed).length,
            render: b => { const cs = db.children('booking_customer', 'booking', b.pk);
              const n = cs.filter(c => c.waiver_signed).length;
              return h('div', { style: { minWidth: '80px' } }, h('div.small.right', `${n}/${cs.length}`), meter(n, cs.length)); } },
          { key: 'waiver_status', label: 'Status', render: b => statusBadge(b.waiver_status) },
          { key: 'act', label: '', sortable: false, render: b => btn('Send reminder', { size: 'sm', onclick: (e) => {
              e.stopPropagation();
              db.insert('message_log', {
                template: db.find('message_template', t => t.trigger === 'waiver_request')?.pk,
                booking: b.pk, to: db.get('contact', b.contact)?.email, medium: 'email',
                subject: 'Action needed: sign your waiver', status: 'delivered',
                sent_at: new Date().toISOString().slice(0, 19),
              });
              toast('Waiver reminder sent', { tone: 'ok' });
            } }) },
        ],
        selectable: true,
        bulkActions: (sel, clear) => [
          btn('Send reminders', { size: 'sm', kind: 'primary', onclick: () => {
            sel.forEach(pk => db.insert('message_log', {
              template: db.find('message_template', t => t.trigger === 'waiver_request')?.pk,
              booking: pk, to: db.get('contact', db.get('booking', pk).contact)?.email, medium: 'email',
              subject: 'Action needed: sign your waiver', status: 'delivered',
              sent_at: new Date().toISOString().slice(0, 19),
            }, { log: false }));
            toast(`${sel.length} reminders sent`, { tone: 'ok' }); clear();
          } }),
        ],
      })),

      signatures: () => card({ flush: true }, dataTable({
        rows: sigs,
        exportName: 'waiver-signatures',
        defaultSort: 'signed_at', defaultDir: 'desc',
        searchPlaceholder: 'Signer name…',
        onRowClick: (s) => openSignature(ctx, s),
        columns: [
          { key: 'signer_name', label: 'Signer', render: s => h('div',
            h('div.strong', s.signer_name),
            s.is_minor ? h('div.small', { style: { color: 'var(--warn)' } }, `Minor — guardian ${s.guardian_name}`) : null) },
          { key: 'template', label: 'Template', value: s => db.label('waiver_template', s.template) },
          { key: 'booking', label: 'Booking', value: s => db.label('booking', s.booking),
            render: s => h('span.mono', db.label('booking', s.booking)) },
          { key: 'signed_at', label: 'Signed', render: s => h('div',
            h('div', F.dateShort(s.signed_at.slice(0, 10))), h('div.small.muted', F.relative(s.signed_at))) },
          { key: 'is_minor', label: 'Minor', render: s => s.is_minor ? badge('Yes', 'warn') : badge('No') },
          { key: 'ip_address', label: 'IP address', render: s => h('span.small.mono.muted', s.ip_address) },
        ],
        filters: [
          { key: 'template', label: 'Any template', options: templates.map(t => [t.pk, t.name]) },
          { key: 'is_minor', label: 'Any signer', options: [['yes', 'Minors only'], ['no', 'Adults only']],
            apply: (r, v) => v === 'yes' ? r.is_minor : !r.is_minor },
        ],
      })),

      templates: () => h('div.grid.c2', ...templates.map(t => card({
        title: t.name,
        sub: `Version ${t.version}`,
        actions: [toggle(t.is_active, v => db.update('waiver_template', t.pk, { is_active: v }))],
      },
        kv([
          ['Minor policy', badge(F.titleCase(t.minor_policy), t.minor_policy === 'not_allowed' ? 'danger' : 'info')],
          ['Signatures collected', F.num(sigs.filter(s => s.template === t.pk).length)],
          ['Required by', `${requiredItems.length} live items`],
        ]),
        h('div.mt-3', h('div.small.strong.mb-2', 'Waiver text'),
          h('div.small.muted', { style: { maxHeight: '110px', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px' } }, t.body)),
        h('div.row.mt-3',
          btn('Edit', { size: 'sm', onclick: () => editTemplate(ctx, t) }),
          btn('Preview signing page', { size: 'sm', onclick: () => previewSigning(ctx, t) })))),
        card({ title: 'Add a template' },
          h('p.small.muted', 'Templates are versioned. Changing the text of a live template creates a new version so signatures stay tied to the wording the guest actually agreed to.'),
          h('div.mt-3', btn('New waiver template', { kind: 'primary', onclick: () => editTemplate(ctx, null) })))),
    };

    return h('div.page',
      pageHead({
        title: 'Waivers',
        sub: 'Digital liability waivers, signed before a guest can participate.',
      }),
      moduleIntro(this, 'An item flagged “requires waiver” puts every guest on its bookings into a pending state. Guests sign from a link in their confirmation email or on a tablet at check-in; each signature records the signer, the timestamp and the IP as evidence.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Signatures on file', value: F.num(sigs.length) }),
        stat({ label: 'Outstanding', value: F.num(outstanding.length), tone: outstanding.length ? 'warn' : null }),
        stat({ label: 'Outstanding on upcoming trips', value: F.num(upcoming.length), tone: upcoming.length ? 'danger' : null }),
        stat({ label: 'Items requiring a waiver', value: F.num(requiredItems.length) })),
      tabs(TABS, tab, id => router.patchQuery({ tab: id })),
      h('div.mt-4', panes[tab]()));
  },
};

function openSignature(ctx, s) {
  const { db } = ctx;
  const t = db.get('waiver_template', s.template);
  drawer({
    title: `Signed by ${s.signer_name}`,
    sub: `${t?.name} ${t?.version} · ${F.dateLong(s.signed_at.slice(0, 10))}`,
    render: () => h('div.col', { style: { gap: 'var(--sp-4)' } },
      card({ title: 'Signature record' }, kv([
        ['Signer', s.signer_name],
        ['Booking', h('a.mono', { href: `#/bookings/detail/${s.booking}` }, db.label('booking', s.booking))],
        ['Template', `${t?.name} (${t?.version})`],
        ['Signed at', `${F.dateLong(s.signed_at.slice(0, 10))} · ${F.time12(s.signed_at.slice(11, 16))}`],
        ['IP address', h('span.mono', s.ip_address)],
        ['Minor', s.is_minor ? badge(`Yes — guardian ${s.guardian_name}`, 'warn') : badge('No')],
      ])),
      card({ title: 'Agreed wording' }, h('p.small', t?.body)),
      card({ title: 'Signature' },
        h('div', { style: { border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', padding: '22px', textAlign: 'center' } },
          h('div', { style: { fontFamily: 'cursive', fontSize: '28px' } }, s.signer_name),
          h('div.small.muted.mt-2', 'Captured electronically')))),
  });
}

function editTemplate(ctx, t) {
  const { db } = ctx;
  const d = t ? { ...t } : { name: '', version: 'v1.0', body: '', minor_policy: 'guardian_signs', is_active: true, items: [] };
  modal({
    title: t ? `Edit ${t.name}` : 'New waiver template',
    width: 'wide',
    render: () => h('div.col',
      h('div.grid.c2',
        h('div.field', h('label', 'Template name'),
          h('input.input', { value: d.name, oninput: e => { d.name = e.target.value; } })),
        h('div.field', h('label', 'Version'),
          h('input.input', { value: d.version, oninput: e => { d.version = e.target.value; } })),
        h('div.field', h('label', 'Minor policy'),
          select([['guardian_signs', 'A guardian signs on their behalf'], ['separate_waiver', 'Minors need their own waiver'], ['not_allowed', 'Minors may not participate']],
            d.minor_policy, v => { d.minor_policy = v; }))),
      h('div.field.mt-3', h('label', 'Waiver text'),
        h('textarea.textarea', { style: 'min-height:200px', value: d.body, oninput: e => { d.body = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn(t ? 'Save changes' : 'Create template', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name the template', { tone: 'warn' });
        if (t) db.update('waiver_template', t.pk, d);
        else db.insert('waiver_template', { company: ctx.domain.company().pk, ...d });
        api.close(); toast('Saved', { tone: 'ok' });
      } })],
  });
}

function previewSigning(ctx, t) {
  modal({
    title: 'Guest signing page',
    sub: 'What a guest sees when they open the waiver link in their confirmation email.',
    width: 'wide',
    render: () => h('div', { style: { border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' } },
      h('div', { style: { background: 'var(--brand-navy)', color: '#fff', padding: '14px 18px' } },
        h('div.strong', ctx.domain.company()?.name),
        h('div.small', { style: { opacity: .8 } }, 'Liability waiver')),
      h('div', { style: { padding: '18px' } },
        h('h3.mb-3', t.name),
        h('p.small', t.body),
        h('div.field.mt-4', h('label', 'Full legal name'), h('input.input', { placeholder: 'As it appears on your ID' })),
        h('div.field', h('label', 'Date of birth'), h('input.input', { type: 'date' })),
        h('div.field', h('label', 'Signature'),
          h('div', { style: { border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', height: '80px', display: 'grid', placeContent: 'center', color: 'var(--fg-subtle)' } }, 'Sign here')),
        h('label.check.mt-3', h('input', { type: 'checkbox' }), 'I have read and agree to the waiver above'),
        h('div.mt-4', btn('Sign waiver', { kind: 'primary', block: true, onclick: () => toast('This is a preview', { tone: 'warn' }) })))),
  });
}
