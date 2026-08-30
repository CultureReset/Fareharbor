import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, toggle, chip, tabs } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { rankBars } from '../core/ui/chart.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

const TYPES = [
  ['short_text', 'Short text'], ['long_text', 'Long text'], ['number', 'Number'],
  ['select', 'Single choice'], ['multi_select', 'Multiple choice'], ['checkbox', 'Checkbox'],
  ['date', 'Date'], ['file', 'File upload'],
];
const LEVELS = [
  ['booking', 'Once per booking'], ['customer', 'Once per guest'], ['item', 'Item configuration'],
];

export default {
  id: 'customfields',
  title: 'Custom Fields',
  icon: '❓',
  group: 'Catalog',
  order: 100,
  summary: 'Operator-defined questions asked at booking or per guest, and where their answers surface.',
  entities: ['custom_field', 'custom_field_value'],

  render(ctx) {
    const { db, router, route } = ctx;
    const fields = db.all('custom_field');
    const values = db.all('custom_field_value');
    const answerCount = (cf) => values.filter(v => v.custom_field === cf.pk).length;

    const table = dataTable({
      rows: fields,
      exportName: 'custom-fields',
      searchPlaceholder: 'Search questions…',
      onRowClick: (cf) => openField(ctx, cf),
      columns: [
        { key: 'title', label: 'Question', render: cf => h('div',
          h('div.strong', cf.title), cf.description && h('div.small.muted', cf.description)) },
        { key: 'type', label: 'Field type', render: cf => badge(TYPES.find(t => t[0] === cf.type)?.[1] || cf.type) },
        { key: 'level', label: 'Asked', render: cf => h('span.small', LEVELS.find(l => l[0] === cf.level)?.[1]) },
        { key: 'is_required', label: 'Required', render: cf => cf.is_required ? badge('Required', 'warn') : badge('Optional') },
        { key: 'show_on_manifest', label: 'On manifest', render: cf => toggle(cf.show_on_manifest, v => db.update('custom_field', cf.pk, { show_on_manifest: v })) },
        { key: 'options', label: 'Choices', sortable: false, render: cf => cf.options?.length
          ? h('div.row', { style: { gap: '3px' } }, ...cf.options.slice(0, 4).map(o => badge(o)),
              cf.options.length > 4 ? h('span.small.muted', `+${cf.options.length - 4}`) : null)
          : h('span.muted', '—') },
        { key: 'answers', label: 'Answers collected', align: 'num', value: cf => answerCount(cf), fmt: F.num },
      ],
      filters: [
        { key: 'level', label: 'Any level', options: LEVELS },
        { key: 'type', label: 'Any type', options: TYPES },
      ],
    });

    const popular = fields.map(cf => ({ label: cf.title, value: answerCount(cf) })).sort((a, b) => b.value - a.value);

    return h('div.page',
      pageHead({
        title: 'Custom Fields',
        sub: 'Questions you ask that the booking form does not ask by default.',
        actions: [btn('New field', { kind: 'primary', icon: '＋', onclick: () => newField(ctx) })],
      }),
      moduleIntro(this, 'A field is asked either once per booking ("emergency contact") or once per guest ("shirt size"). Answers are stored against the booking or the individual booking_customer, and any field flagged "on manifest" appears in the guide’s guest list.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Fields defined', value: F.num(fields.length) }),
        stat({ label: 'Asked per guest', value: F.num(fields.filter(f => f.level === 'customer').length) }),
        stat({ label: 'Required', value: F.num(fields.filter(f => f.is_required).length) }),
        stat({ label: 'Answers on file', value: F.num(values.length) })),
      h('div.grid.side',
        card({ flush: true }, table),
        h('div.col',
          card({ title: 'Most answered' }, rankBars(popular, { money: false, limit: 8 })),
          card({ title: 'Form preview', sub: 'What the guest sees at checkout' },
            h('div.col', ...fields.filter(f => f.level === 'booking').slice(0, 6).map(cf => renderControl(cf)))))));
  },
};

function renderControl(cf) {
  const label = h('label', cf.title, cf.is_required ? h('span', { style: { color: 'var(--danger)' } }, ' *') : null);
  const control = cf.type === 'long_text' ? h('textarea.textarea', { placeholder: 'Type your answer' })
    : cf.type === 'select' ? h('select.select', ...(cf.options || []).map(o => h('option', o)))
    : cf.type === 'checkbox' ? h('label.check', h('input', { type: 'checkbox' }), 'Yes')
    : cf.type === 'number' ? h('input.input', { type: 'number' })
    : cf.type === 'date' ? h('input.input', { type: 'date' })
    : cf.type === 'multi_select' ? h('div.row', ...(cf.options || []).map(o => h('label.check', h('input', { type: 'checkbox' }), o)))
    : cf.type === 'file' ? h('input.input', { type: 'file' })
    : h('input.input', { placeholder: 'Type your answer' });
  return h('div.field', label, control, cf.description && h('div.hint', cf.description));
}

function openField(ctx, cf) {
  const { db } = ctx;
  drawer({
    title: cf.title,
    sub: `${TYPES.find(t => t[0] === cf.type)?.[1]} · ${LEVELS.find(l => l[0] === cf.level)?.[1]}`,
    render: (api) => {
      const answers = db.where('custom_field_value', v => v.custom_field === cf.pk);
      const dist = db.groupBy(answers, a => a.value, {}).map(g => ({ label: g.key, value: g.count })).sort((a, b) => b.value - a.value);
      return h('div.col', { style: { gap: 'var(--sp-4)' } },
        card({ title: 'Configuration' }, h('div.grid.c2',
          h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Question'),
            h('input.input', { value: cf.title, onchange: e => db.update('custom_field', cf.pk, { title: e.target.value }) })),
          h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Helper text'),
            h('input.input', { value: cf.description || '', placeholder: 'Shown under the question',
              onchange: e => db.update('custom_field', cf.pk, { description: e.target.value }) })),
          h('div.field', h('label', 'Field type'), select(TYPES, cf.type, v => { db.update('custom_field', cf.pk, { type: v }); api.refresh(); })),
          h('div.field', h('label', 'Asked at'), select(LEVELS, cf.level, v => { db.update('custom_field', cf.pk, { level: v }); api.refresh(); })),
          h('div.field', h('label', 'Required'), toggle(cf.is_required, v => db.update('custom_field', cf.pk, { is_required: v }))),
          h('div.field', h('label', 'Show on manifest'), toggle(cf.show_on_manifest, v => db.update('custom_field', cf.pk, { show_on_manifest: v }))),
          ['select', 'multi_select'].includes(cf.type) ? h('div.field', { style: { gridColumn: '1 / -1' } },
            h('label', 'Choices (one per line)'),
            h('textarea.textarea', { value: (cf.options || []).join('\n'),
              onchange: e => { db.update('custom_field', cf.pk, { options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }); api.refresh(); } })) : null)),
        card({ title: 'Guest preview' }, renderControl(cf)),
        dist.length ? card({ title: `Answer distribution (${F.num(answers.length)} answers)` },
          rankBars(dist, { money: false, limit: 10 })) : null,
        card({ title: 'Recent answers', flush: true },
          answers.length ? simpleTable(['Booking', 'Guest', 'Answer'],
            answers.slice(-15).reverse().map(a => [
              h('a.mono.small', { href: `#/bookings/detail/${a.booking}` }, db.label('booking', a.booking)),
              a.booking_customer ? db.get('booking_customer', a.booking_customer)?.name || '—' : 'Booking level',
              h('span.strong', a.value),
            ])) : empty('No answers yet')));
    },
    foot: (api) => [btn('Delete field', { kind: 'danger', onclick: () => confirm({
      title: `Delete "${cf.title}"?`,
      body: 'Existing answers are deleted with it. This cannot be undone.',
      confirmLabel: 'Delete field', tone: 'danger',
      onConfirm: () => {
        db.where('custom_field_value', v => v.custom_field === cf.pk).forEach(v => db.remove('custom_field_value', v.pk, { log: false }));
        db.remove('custom_field', cf.pk); api.close(); toast('Field deleted', { tone: 'ok' });
      },
    }) })],
  });
}

function newField(ctx) {
  const { db } = ctx;
  const d = { title: '', type: 'short_text', level: 'booking', options: [], is_required: false, show_on_manifest: true, description: '' };
  modal({
    title: 'New custom field',
    render: (api) => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Question'),
        h('input.input', { placeholder: 'What is your shoe size?', oninput: e => { d.title = e.target.value; } })),
      h('div.field', h('label', 'Field type'), select(TYPES, d.type, v => { d.type = v; api.refresh(); })),
      h('div.field', h('label', 'Asked at'), select(LEVELS, d.level, v => { d.level = v; })),
      ['select', 'multi_select'].includes(d.type) ? h('div.field', { style: { gridColumn: '1 / -1' } },
        h('label', 'Choices (one per line)'),
        h('textarea.textarea', { oninput: e => { d.options = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); } })) : null,
      h('div.field', h('label', 'Required'), toggle(d.is_required, v => { d.is_required = v; })),
      h('div.field', h('label', 'Show on manifest'), toggle(d.show_on_manifest, v => { d.show_on_manifest = v; }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Create field', { kind: 'primary', onclick: () => {
        if (!d.title.trim()) return toast('Write the question first', { tone: 'warn' });
        db.insert('custom_field', { company: ctx.domain.company().pk, items: [], ...d });
        api.close(); toast('Custom field created', { tone: 'ok' });
      } })],
  });
}
