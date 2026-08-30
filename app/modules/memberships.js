import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, toggle, tabs, meter } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast } from '../core/ui/overlay.js';
import { donut, legend, rankBars } from '../core/ui/chart.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'memberships',
  title: 'Memberships',
  icon: '⭐',
  group: 'Guests',
  order: 150,
  summary: 'Season passes and punch cards: plans, members, renewals and lapse risk.',
  entities: ['membership_type', 'membership', 'contact'],

  render(ctx) {
    const { db, router, route } = ctx;
    const tab = route.query.tab || 'members';
    const plans = db.all('membership_type');
    const members = db.all('membership');
    const active = members.filter(m => m.status === 'active');
    const renewingSoon = active.filter(m => m.renews_on <= F.addDays(F.today(), 30));
    const pastDue = members.filter(m => m.status === 'past_due');

    const mrr = active.reduce((s, m) => {
      const p = db.get('membership_type', m.membership_type);
      if (!p) return s;
      return s + (p.billing === 'monthly' ? p.price : p.billing === 'annual' ? Math.round(p.price / 12) : 0);
    }, 0);

    const byPlan = plans.map(p => ({ label: p.name, value: members.filter(m => m.membership_type === p.pk && m.status === 'active').length }));
    const byStatus = db.groupBy(members, m => F.titleCase(m.status), {}).map(g => ({ label: g.key, value: g.count }));

    const TABS = [
      { id: 'members', title: 'Members', count: members.length },
      { id: 'plans', title: 'Plans', count: plans.length },
    ];

    const panes = {
      members: () => card({ flush: true }, dataTable({
        rows: members,
        exportName: 'members',
        defaultSort: 'renews_on',
        searchPlaceholder: 'Member name…',
        onRowClick: (m) => router.go(`/contacts/detail/${m.contact}`),
        columns: [
          { key: 'contact', label: 'Member', value: m => db.label('contact', m.contact),
            render: m => { const c = db.get('contact', m.contact);
              return h('div', h('div.strong', c?.name), h('div.small.muted', c?.email)); } },
          { key: 'membership_type', label: 'Plan', value: m => db.label('membership_type', m.membership_type) },
          { key: 'started_on', label: 'Started', fmt: F.dateShort },
          { key: 'renews_on', label: 'Renews', render: m => {
              const soon = m.renews_on <= F.addDays(F.today(), 30) && m.status === 'active';
              return h('div', h('div', { style: { color: soon ? 'var(--warn)' : null, fontWeight: soon ? 600 : 400 } }, F.dateShort(m.renews_on)),
                h('div.small.muted', F.relative(m.renews_on + 'T12:00:00'))); } },
          { key: 'visits_used', label: 'Visits used', align: 'num', render: m => {
              const p = db.get('membership_type', m.membership_type);
              if (p?.benefit !== 'free_visits') return h('span.muted', `${m.visits_used}`);
              return h('div', { style: { minWidth: '90px' } },
                h('div.small.right', `${m.visits_used}/${p.benefit_value}`), meter(m.visits_used, p.benefit_value)); } },
          { key: 'status', label: 'Status', render: m => statusBadge(m.status) },
        ],
        filters: [
          { key: 'status', label: 'Any status', options: ['active', 'lapsed', 'past_due', 'cancelled'].map(s => [s, F.titleCase(s)]) },
          { key: 'membership_type', label: 'Any plan', options: plans.map(p => [p.pk, p.name]) },
        ],
      })),

      plans: () => h('div.grid.c3', ...plans.map(p => card({
        title: p.name,
        actions: [toggle(p.is_active, v => db.update('membership_type', p.pk, { is_active: v }))],
      },
        h('div', { style: { fontSize: '26px', fontWeight: 700 } }, F.money(p.price),
          h('span.small.muted', p.billing === 'monthly' ? ' / month' : p.billing === 'annual' ? ' / year' : ' one-time')),
        h('div.mt-3', kv([
          ['Benefit', p.benefit === 'percent_off' ? `${p.benefit_value}% off every booking`
            : p.benefit === 'free_visits' ? `${p.benefit_value} included visits`
            : 'Unlimited access'],
          ['Active members', F.num(members.filter(m => m.membership_type === p.pk && m.status === 'active').length)],
          ['Annualised value', F.money(members.filter(m => m.membership_type === p.pk && m.status === 'active').length
            * (p.billing === 'monthly' ? p.price * 12 : p.price))],
        ])),
        h('div.row.mt-3', btn('Edit plan', { size: 'sm', onclick: () => editPlan(ctx, p) })))),
        card({ title: 'Add a plan' },
          h('p.small.muted', 'A plan defines the price, the billing cadence and what the member gets. Benefits are applied automatically when a member books.'),
          h('div.mt-3', btn('New plan', { kind: 'primary', onclick: () => editPlan(ctx, null) })))),
    };

    return h('div.page',
      pageHead({
        title: 'Memberships',
        sub: 'Recurring relationships: season passes, clubs and multi-visit punch cards.',
        actions: [btn('Enrol a member', { kind: 'primary', icon: '＋', onclick: () => enrol(ctx) })],
      }),
      moduleIntro(this, 'A membership links a contact to a plan. At checkout the plan’s benefit is applied before taxes — a percentage discount, a decremented visit count, or unlimited access.'),
      h('div.grid.c5.mb-4',
        stat({ label: 'Members', value: F.num(members.length) }),
        stat({ label: 'Active', value: F.num(active.length) }),
        stat({ label: 'Monthly recurring value', value: F.money(mrr) }),
        stat({ label: 'Renewing in 30 days', value: F.num(renewingSoon.length), tone: 'warn' }),
        stat({ label: 'Past due', value: F.num(pastDue.length), tone: pastDue.length ? 'danger' : null })),
      h('div.grid.side.mb-4',
        card({ title: 'Members by plan' }, rankBars(byPlan, { money: false })),
        card({ title: 'Member states' },
          h('div.row', { style: { gap: '16px', alignItems: 'center' } },
            donut(byStatus, { centerLabel: F.num(active.length), centerSub: 'active' }),
            h('div', { style: { flex: 1 } }, legend(byStatus))))),
      tabs(TABS, tab, id => router.patchQuery({ tab: id })),
      h('div.mt-4', panes[tab]()));
  },
};

function editPlan(ctx, p) {
  const { db } = ctx;
  const d = p ? { ...p } : { name: '', price: 10000, billing: 'annual', benefit: 'percent_off', benefit_value: 10, is_active: true, items: [], member_count: 0 };
  modal({
    title: p ? `Edit ${p.name}` : 'New membership plan',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Plan name'),
        h('input.input', { value: d.name, placeholder: 'Harbor Club — Annual', oninput: e => { d.name = e.target.value; } })),
      h('div.field', h('label', 'Price'),
        h('input.input', { type: 'number', step: '0.01', value: (d.price / 100).toFixed(2), oninput: e => { d.price = Math.round(Number(e.target.value) * 100); } })),
      h('div.field', h('label', 'Billing'), select([['one_time', 'One-time'], ['monthly', 'Monthly'], ['annual', 'Annual']], d.billing, v => { d.billing = v; })),
      h('div.field', h('label', 'Benefit'),
        select([['percent_off', 'Percentage off bookings'], ['free_visits', 'Included visits'], ['unlimited', 'Unlimited access']], d.benefit, v => { d.benefit = v; })),
      h('div.field', h('label', 'Benefit value'),
        h('input.input', { type: 'number', value: d.benefit_value, oninput: e => { d.benefit_value = Number(e.target.value); } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn(p ? 'Save' : 'Create plan', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name the plan', { tone: 'warn' });
        if (p) db.update('membership_type', p.pk, d);
        else db.insert('membership_type', { company: ctx.domain.company().pk, ...d });
        api.close(); toast('Saved', { tone: 'ok' });
      } })],
  });
}

function enrol(ctx) {
  const { db } = ctx;
  const plans = db.where('membership_type', p => p.is_active);
  const contacts = db.all('contact').slice(0, 200);
  const d = { membership_type: plans[0]?.pk, contact: contacts[0]?.pk };
  modal({
    title: 'Enrol a member',
    render: () => h('div.col',
      h('div.field', h('label', 'Guest'),
        select(contacts.map(c => [c.pk, `${c.name} — ${c.email}`]), d.contact, v => { d.contact = v; })),
      h('div.field', h('label', 'Plan'),
        select(plans.map(p => [p.pk, `${p.name} — ${F.money(p.price)}`]), d.membership_type, v => { d.membership_type = v; }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Enrol', { kind: 'primary', onclick: () => {
        const p = db.get('membership_type', d.membership_type);
        db.insert('membership', { ...d, started_on: F.today(),
          renews_on: p.billing === 'monthly' ? F.addDays(F.today(), 30) : F.addDays(F.today(), 365),
          visits_used: 0, status: 'active' });
        db.update('membership_type', p.pk, { member_count: p.member_count + 1 }, { log: false });
        api.close(); toast(`${db.label('contact', d.contact)} enrolled`, { tone: 'ok' });
      } })],
  });
}
