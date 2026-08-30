import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, tabs, toggle, kv, meter } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { modal, toast, confirm, drawer } from '../core/ui/overlay.js';
import { rankBars } from '../core/ui/chart.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'pricing',
  title: 'Pricing & Promos',
  icon: '🏷',
  group: 'Catalog',
  order: 90,
  summary: 'Customer types, rates per item, taxes and fees, and the promo codes layered on top.',
  entities: ['customer_type', 'customer_type_rate', 'tax_fee', 'promo_code'],

  render(ctx) {
    const { db, domain, router, route } = ctx;
    const tab = route.query.tab || 'matrix';
    const TABS = [
      { id: 'matrix', title: 'Rate matrix' },
      { id: 'types', title: 'Customer types', count: db.count('customer_type') },
      { id: 'taxes', title: 'Taxes & fees', count: db.count('tax_fee') },
      { id: 'promos', title: 'Promo codes', count: db.count('promo_code') },
    ];

    const items = db.where('item', i => i.status !== 'archived');
    const types = db.all('customer_type');

    const panes = {
      /* every item × every customer type, editable in place */
      matrix: () => card({
        title: 'Rate matrix', sub: 'Every item against every customer type. Blank means that type is not sold on that item.', flush: true,
      }, simpleTable(
        ['Item', ...types.map(t => ({ label: t.singular, align: 'num' })), { label: 'Spread', align: 'num' }],
        items.map(it => {
          const rates = domain.ratesFor(it.pk);
          const vals = rates.map(r => r.total).filter(v => v > 0);
          return [
            h('div', h('div.strong', it.name), h('div.small.muted', F.titleCase(it.category))),
            ...types.map(t => {
              const r = rates.find(x => x.customer_type === t.pk);
              if (!r) return h('button.btn.ghost.sm', {
                onclick: () => {
                  db.insert('customer_type_rate', { item: it.pk, customer_type: t.pk, availability: null,
                    total: 0, cost: 0, minimum_party_size: 0, maximum_party_size: it.max_party, is_active: true });
                  toast(`${t.singular} rate added to ${it.name}`, { tone: 'ok' });
                },
              }, '＋');
              return h('input.input', {
                type: 'number', step: '0.01', value: (r.total / 100).toFixed(2),
                style: 'width:92px;text-align:right;padding:3px 6px;font-size:var(--fs-sm)',
                onchange: e => db.update('customer_type_rate', r.pk, { total: Math.round(Number(e.target.value) * 100) }),
              });
            }),
            vals.length ? `${F.money(Math.min(...vals))} – ${F.money(Math.max(...vals))}` : '—',
          ];
        }))),

      types: () => h('div.col',
        card({ title: 'Customer types', sub: 'Company-wide. Each item picks which ones it sells and at what price.', flush: true,
          actions: [btn('Add type', { size: 'sm', kind: 'primary', onclick: () => newType(ctx) })] },
          simpleTable(['Singular', 'Plural', 'Qualifier', 'Uses a seat', { label: 'Used on items', align: 'num' }, ''],
            types.map(t => [
              h('input.input', { value: t.singular, style: 'width:120px', onchange: e => db.update('customer_type', t.pk, { singular: e.target.value }) }),
              h('input.input', { value: t.plural, style: 'width:120px', onchange: e => db.update('customer_type', t.pk, { plural: e.target.value }) }),
              h('input.input', { value: t.note || '', onchange: e => db.update('customer_type', t.pk, { note: e.target.value }) }),
              toggle(t.counts_against_capacity, v => db.update('customer_type', t.pk, { counts_against_capacity: v })),
              db.where('customer_type_rate', r => r.customer_type === t.pk).length,
              btn('Delete', { size: 'sm', kind: 'ghost', onclick: () => confirm({
                title: `Delete ${t.singular}?`, body: 'Its rates are removed from every item.', confirmLabel: 'Delete', tone: 'danger',
                onConfirm: () => {
                  db.where('customer_type_rate', r => r.customer_type === t.pk).forEach(r => db.remove('customer_type_rate', r.pk, { log: false }));
                  db.remove('customer_type', t.pk); toast('Customer type deleted', { tone: 'ok' });
                },
              }) }),
            ]))),
        card({ title: 'Why "uses a seat" matters' },
          h('p.small', 'A type with this switch off — a lap infant, a non-participating observer on a boat with spare deck '
            + 'space — can be added to a booking without consuming capacity. It still appears on the manifest and can still be '
            + 'charged, but the availability’s ', h('span.mono', 'booked'), ' count ignores it.'))),

      taxes: () => h('div.col',
        card({ title: 'Taxes & fees', sub: 'Applied on top of the subtotal at checkout', flush: true,
          actions: [btn('Add', { size: 'sm', kind: 'primary', onclick: () => newTax(ctx) })] },
          simpleTable(['Name', 'Type', 'Calculation', { label: 'Rate', align: 'num' }, 'Included in price', 'Active', ''],
            db.all('tax_fee').map(t => [
              h('input.input', { value: t.name, onchange: e => db.update('tax_fee', t.pk, { name: e.target.value }) }),
              select([['tax', 'Tax'], ['fee', 'Fee']], t.kind, v => db.update('tax_fee', t.pk, { kind: v })),
              select([['percent', 'Percentage'], ['flat_per_booking', 'Flat per booking'], ['flat_per_customer', 'Flat per guest']],
                t.calculation, v => db.update('tax_fee', t.pk, { calculation: v })),
              t.calculation === 'percent'
                ? h('input.input', { type: 'number', step: '0.001', value: t.rate, style: 'width:90px;text-align:right',
                    onchange: e => db.update('tax_fee', t.pk, { rate: Number(e.target.value) }) })
                : h('input.input', { type: 'number', step: '0.01', value: (t.rate / 100).toFixed(2), style: 'width:90px;text-align:right',
                    onchange: e => db.update('tax_fee', t.pk, { rate: Math.round(Number(e.target.value) * 100) }) }),
              toggle(t.is_inclusive, v => db.update('tax_fee', t.pk, { is_inclusive: v })),
              toggle(t.is_active, v => db.update('tax_fee', t.pk, { is_active: v })),
              btn('Delete', { size: 'sm', kind: 'ghost', onclick: () => { db.remove('tax_fee', t.pk); toast('Removed'); } }),
            ]))),
        card({ title: 'Worked example' }, (() => {
          const it = items[0];
          const rates = domain.ratesFor(it.pk);
          const q = domain.quote({ item: it, lines: rates.slice(0, 1).map(r => ({ rate: r, qty: 2 })) });
          return h('div',
            h('p.small.muted', `Two ${db.get('customer_type', rates[0]?.customer_type)?.plural?.toLowerCase() || 'guests'} on ${it.name}:`),
            h('dl.kv',
              h('dt', 'Subtotal'), h('dd.right', F.money(q.subtotal)),
              ...q.taxLines.flatMap(t => [h('dt', t.name), h('dd.right', F.money(t.amount))]),
              h('dt', { style: { fontWeight: 700, color: 'var(--fg)' } }, 'Guest pays'),
              h('dd.right.strong', F.money(q.total))));
        })())),

      promos: () => {
        const promos = db.all('promo_code');
        const usage = promos.map(p => ({ label: p.code, value: p.used })).sort((a, b) => b.value - a.value);
        return h('div.grid.side',
          card({ title: 'Promo codes', flush: true,
            actions: [btn('New code', { size: 'sm', kind: 'primary', onclick: () => newPromo(ctx) })] },
            dataTable({
              rows: promos,
              exportName: 'promo-codes',
              searchPlaceholder: 'Search codes…',
              columns: [
                { key: 'code', label: 'Code', render: p => h('span.mono.strong', p.code) },
                { key: 'kind', label: 'Discount', render: p => p.kind === 'percent' ? `${p.value}% off` : `${F.money(p.value)} off` },
                { key: 'starts', label: 'Valid', value: p => p.starts, render: p => `${F.dateShort(p.starts)} – ${F.dateShort(p.ends)}` },
                { key: 'used', label: 'Used', align: 'num', render: p => h('div', { style: { minWidth: '90px' } },
                  h('div.small.right', `${F.num(p.used)} / ${F.num(p.max_uses)}`), meter(p.used, p.max_uses)) },
                { key: 'redeemed', label: 'Discount given', align: 'num',
                  value: p => db.where('booking', b => b.promo_code === p.pk).reduce((s, b) => s + b.discount_total, 0),
                  fmt: F.money },
                { key: 'is_active', label: 'Active', render: p => toggle(p.is_active, v => db.update('promo_code', p.pk, { is_active: v })) },
              ],
            })),
          h('div.col',
            card({ title: 'Redemptions by code' }, rankBars(usage, { money: false, limit: 8 })),
            card({ title: 'How codes resolve' },
              h('p.small', 'At checkout the code is matched case-insensitively, then checked against its date window and '
                + 'usage cap. A percentage code applies to the subtotal plus add-ons but before taxes; a fixed code is '
                + 'capped at the subtotal so it can never make a booking negative. The discount is stored on the booking as ',
                h('span.mono', 'discount_total'), ', so reports can separate list price from realised price.'))));
      },
    };

    return h('div.page',
      pageHead({ title: 'Pricing & Promos', sub: 'What a seat costs, what gets added on top, and what comes back off.' }),
      moduleIntro(this, 'Price = rate for the customer type × quantity, minus discounts, plus taxes and fees. That calculation lives in one function (domain.quote) shared by the booking wizard, the storefront and every report.'),
      tabs(TABS, tab, id => router.patchQuery({ tab: id })),
      h('div.mt-4', panes[tab]()));
  },
};

function newType(ctx) {
  const { db } = ctx;
  const d = { singular: '', plural: '', note: '', counts_against_capacity: true };
  modal({ title: 'New customer type',
    render: () => h('div.grid.c2',
      h('div.field', h('label', 'Singular'), h('input.input', { placeholder: 'Student', oninput: e => { d.singular = e.target.value; } })),
      h('div.field', h('label', 'Plural'), h('input.input', { placeholder: 'Students', oninput: e => { d.plural = e.target.value; } })),
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Qualifier'),
        h('input.input', { placeholder: 'Valid ID required', oninput: e => { d.note = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Add', { kind: 'primary', onclick: () => {
        if (!d.singular) return toast('Name it', { tone: 'warn' });
        db.insert('customer_type', { company: ctx.domain.company().pk, ...d, plural: d.plural || d.singular + 's' });
        api.close(); toast('Customer type added', { tone: 'ok' });
      } })] });
}

function newTax(ctx) {
  const { db } = ctx;
  const d = { name: '', kind: 'tax', calculation: 'percent', rate: 0.05, is_inclusive: false, is_active: true, applies_to: [] };
  modal({ title: 'New tax or fee',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Name'),
        h('input.input', { placeholder: 'City tourism levy', oninput: e => { d.name = e.target.value; } })),
      h('div.field', h('label', 'Type'), select([['tax', 'Tax'], ['fee', 'Fee']], d.kind, v => { d.kind = v; })),
      h('div.field', h('label', 'Calculation'),
        select([['percent', 'Percentage'], ['flat_per_booking', 'Flat per booking'], ['flat_per_customer', 'Flat per guest']], d.calculation, v => { d.calculation = v; })),
      h('div.field', h('label', 'Rate (0.05 = 5%, or cents for flat)'),
        h('input.input', { type: 'number', step: '0.001', value: d.rate, oninput: e => { d.rate = Number(e.target.value); } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Add', { kind: 'primary', onclick: () => {
        if (!d.name) return toast('Name it', { tone: 'warn' });
        db.insert('tax_fee', { company: ctx.domain.company().pk, ...d });
        api.close(); toast('Added', { tone: 'ok' });
      } })] });
}

function newPromo(ctx) {
  const { db } = ctx;
  const d = { code: '', kind: 'percent', value: 10, starts: F.today(), ends: F.addDays(F.today(), 90), max_uses: 100 };
  modal({ title: 'New promo code',
    render: () => h('div.grid.c2',
      h('div.field', h('label', 'Code'),
        h('input.input', { placeholder: 'SHOULDER25', style: 'text-transform:uppercase', oninput: e => { d.code = e.target.value.toUpperCase(); } })),
      h('div.field', h('label', 'Discount type'), select([['percent', 'Percentage off'], ['fixed', 'Fixed amount off']], d.kind, v => { d.kind = v; })),
      h('div.field', h('label', 'Value'), h('input.input', { type: 'number', value: d.value, oninput: e => { d.value = Number(e.target.value); } })),
      h('div.field', h('label', 'Usage cap'), h('input.input', { type: 'number', value: d.max_uses, oninput: e => { d.max_uses = Number(e.target.value); } })),
      h('div.field', h('label', 'Valid from'), h('input.input', { type: 'date', value: d.starts, onchange: e => { d.starts = e.target.value; } })),
      h('div.field', h('label', 'Valid until'), h('input.input', { type: 'date', value: d.ends, onchange: e => { d.ends = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Create code', { kind: 'primary', onclick: () => {
        if (!d.code) return toast('Enter a code', { tone: 'warn' });
        db.insert('promo_code', { company: ctx.domain.company().pk, ...d,
          value: d.kind === 'fixed' ? d.value * 100 : d.value, used: 0, items: [], channels: [], is_active: true });
        api.close(); toast(`${d.code} is live`, { tone: 'ok' });
      } })] });
}
