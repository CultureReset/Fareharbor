import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, simpleTable, kv, meter } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast } from '../core/ui/overlay.js';
import { barChart, donut, legend } from '../core/ui/chart.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'giftcards',
  title: 'Gift Cards',
  icon: '🎁',
  group: 'Guests',
  order: 140,
  summary: 'Issued cards, remaining balances, redemption history and the outstanding liability they represent.',
  entities: ['gift_card'],

  search(q, ctx) {
    const ql = q.toUpperCase();
    return ctx.db.where('gift_card', g => g.code.includes(ql)).slice(0, 4)
      .map(g => ({ title: g.code, sub: `${F.money(g.balance)} of ${F.money(g.initial_value)} remaining`, path: '/giftcards', kind: g.status }));
  },

  render(ctx) {
    const { db } = ctx;
    const cards = db.all('gift_card');
    const active = cards.filter(g => g.status === 'active');
    const liability = active.reduce((s, g) => s + g.balance, 0);
    const issued = cards.reduce((s, g) => s + g.initial_value, 0);
    const redeemed = issued - cards.reduce((s, g) => s + g.balance, 0);
    const expiringSoon = active.filter(g => g.expires_on <= F.addDays(F.today(), 60));

    const byStatus = db.groupBy(cards, g => F.titleCase(g.status), {}).map(g => ({ label: g.key, value: g.count }));

    const byMonth = [];
    for (let i = 11; i >= 0; i--) {
      const m = F.addMonths(F.today(), -i).slice(0, 7);
      const rows = cards.filter(g => g.issued_on.slice(0, 7) === m);
      byMonth.push({ label: m.slice(2), short: m.slice(5), value: rows.reduce((s, g) => s + g.initial_value, 0) });
    }

    const table = dataTable({
      rows: cards,
      exportName: 'gift-cards',
      defaultSort: 'issued_on', defaultDir: 'desc',
      searchPlaceholder: 'Code, purchaser or recipient…',
      onRowClick: (g) => openCard(ctx, g),
      columns: [
        { key: 'code', label: 'Code', render: g => h('span.mono.strong', g.code) },
        { key: 'initial_value', label: 'Issued for', align: 'num', fmt: F.money },
        { key: 'balance', label: 'Balance', align: 'num', render: g => h('div', { style: { minWidth: '110px' } },
          h('div.right.strong', F.money(g.balance)), meter(g.initial_value - g.balance, g.initial_value, 'ok')) },
        { key: 'purchaser_name', label: 'Purchased by', render: g => h('div',
          h('div', g.purchaser_name), h('div.small.muted', g.purchaser_email)) },
        { key: 'recipient_name', label: 'For' },
        { key: 'issued_on', label: 'Issued', fmt: F.dateShort },
        { key: 'expires_on', label: 'Expires', render: g => {
            const soon = g.expires_on <= F.addDays(F.today(), 60) && g.status === 'active';
            return h('span', { style: { color: soon ? 'var(--warn)' : null, fontWeight: soon ? 600 : 400 } }, F.dateShort(g.expires_on));
          } },
        { key: 'status', label: 'Status', render: g => statusBadge(g.status) },
      ],
      filters: [
        { key: 'status', label: 'Any status', options: ['active', 'redeemed', 'expired', 'void'].map(s => [s, F.titleCase(s)]) },
        { key: 'expiring', label: 'Any expiry', options: [['soon', 'Expiring in 60 days'], ['later', 'Later']],
          apply: (g, v) => v === 'soon' ? g.expires_on <= F.addDays(F.today(), 60) : g.expires_on > F.addDays(F.today(), 60) },
      ],
      totals: (rows) => ({
        initial_value: F.money(rows.reduce((s, g) => s + g.initial_value, 0)),
        balance: F.money(rows.reduce((s, g) => s + g.balance, 0)),
      }),
    });

    return h('div.page',
      pageHead({
        title: 'Gift Cards',
        sub: 'Stored value sold now and redeemed later. The unredeemed balance is a real liability on your books.',
        actions: [btn('Issue a card', { kind: 'primary', icon: '＋', onclick: () => issueCard(ctx) })],
      }),
      moduleIntro(this, 'A gift card is a payment method: redeeming one writes a payment row of method "gift_card" against the booking and decrements the card balance.'),
      h('div.grid.c5.mb-4',
        stat({ label: 'Cards issued', value: F.num(cards.length) }),
        stat({ label: 'Face value sold', value: F.money(issued) }),
        stat({ label: 'Redeemed', value: F.money(redeemed),
          hint: issued ? `${F.pct(redeemed / issued, 0)} of face value` : null }),
        stat({ label: 'Outstanding liability', value: F.money(liability), tone: 'warn' }),
        stat({ label: 'Expiring in 60 days', value: F.num(expiringSoon.length),
          hint: F.money(expiringSoon.reduce((s, g) => s + g.balance, 0)) })),
      h('div.grid.side.mb-4',
        card({ title: 'Face value issued per month' }, barChart(byMonth, { height: 180 })),
        card({ title: 'Card states' },
          h('div.row', { style: { gap: '16px', alignItems: 'center' } },
            donut(byStatus, { centerLabel: F.num(cards.length), centerSub: 'cards' }),
            h('div', { style: { flex: 1 } }, legend(byStatus))))),
      card({ flush: true }, table));
  },
};

function openCard(ctx, g) {
  const { db } = ctx;
  drawer({
    title: g.code,
    sub: `${F.money(g.balance)} of ${F.money(g.initial_value)} remaining`,
    badge: statusBadge(g.status),
    render: (api) => h('div.col', { style: { gap: 'var(--sp-4)' } },
      card({ title: 'Card' }, kv([
        ['Code', h('span.mono.strong', g.code)],
        ['Face value', F.money(g.initial_value)],
        ['Balance', h('span.strong', F.money(g.balance))],
        ['Redeemed', F.money(g.initial_value - g.balance)],
        ['Purchased by', `${g.purchaser_name} · ${g.purchaser_email}`],
        ['Recipient', g.recipient_name],
        ['Issued', F.dateShort(g.issued_on)],
        ['Expires', F.dateShort(g.expires_on)],
      ])),
      card({ title: 'Adjust balance' },
        (() => {
          let amount = 0;
          return h('div.row',
            h('input.input', { type: 'number', step: '0.01', placeholder: '0.00', style: 'max-width:140px',
              oninput: e => { amount = Math.round(Number(e.target.value) * 100); } }),
            btn('Add value', { onclick: () => {
              db.update('gift_card', g.pk, { balance: g.balance + amount, status: 'active' });
              api.refresh(); toast(`${F.money(amount)} added`, { tone: 'ok' });
            } }),
            btn('Redeem', { kind: 'primary', onclick: () => {
              const take = Math.min(amount, g.balance);
              db.update('gift_card', g.pk, { balance: g.balance - take, status: g.balance - take === 0 ? 'redeemed' : 'active' });
              api.refresh(); toast(`${F.money(take)} redeemed`, { tone: 'ok' });
            } }));
        })()),
      card({ title: 'Printable card' },
        h('div', { style: { background: 'linear-gradient(135deg, var(--brand-navy), var(--brand-blue))', color: '#fff', borderRadius: 'var(--r-lg)', padding: '22px' } },
          h('div.small', { style: { opacity: .8 } }, ctx.domain.company()?.name),
          h('div', { style: { fontSize: '26px', fontWeight: 700, margin: '10px 0' } }, F.money(g.balance)),
          h('div.mono', { style: { letterSpacing: '.2em' } }, g.code),
          h('div.small.mt-3', { style: { opacity: .8 } }, `Valid until ${F.dateShort(g.expires_on)}`)))),
    foot: (api) => [
      btn('Void card', { kind: 'danger', onclick: () => { db.update('gift_card', g.pk, { status: 'void' }); api.refresh(); toast('Card voided'); } }),
      btn('Email to recipient', { kind: 'primary', onclick: () => toast('Gift card emailed', { tone: 'ok' }) }),
    ],
  });
}

function issueCard(ctx) {
  const { db } = ctx;
  const d = { initial_value: 10000, purchaser_name: '', purchaser_email: '', recipient_name: '' };
  modal({
    title: 'Issue a gift card',
    render: () => h('div.grid.c2',
      h('div.field', h('label', 'Amount'),
        h('input.input', { type: 'number', step: '0.01', value: (d.initial_value / 100).toFixed(2),
          oninput: e => { d.initial_value = Math.round(Number(e.target.value) * 100); } })),
      h('div.field', h('label', 'Recipient name'), h('input.input', { oninput: e => { d.recipient_name = e.target.value; } })),
      h('div.field', h('label', 'Purchaser name'), h('input.input', { oninput: e => { d.purchaser_name = e.target.value; } })),
      h('div.field', h('label', 'Purchaser email'), h('input.input', { type: 'email', oninput: e => { d.purchaser_email = e.target.value; } }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Issue card', { kind: 'primary', onclick: () => {
        const code = 'GC-' + Math.random().toString(36).toUpperCase().slice(2, 8);
        db.insert('gift_card', {
          company: ctx.domain.company().pk, code, ...d, balance: d.initial_value,
          issued_on: F.today(), expires_on: F.addDays(F.today(), 730), status: 'active',
        });
        api.close(); toast(`${code} issued`, { detail: F.money(d.initial_value), tone: 'ok' });
      } })],
  });
}
