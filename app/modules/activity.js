import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, simpleTable, avatar, timeline } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { rankBars } from '../core/ui/chart.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'activity',
  title: 'Activity Log',
  icon: '🕘',
  group: 'Admin',
  order: 250,
  summary: 'The immutable audit trail: who changed what, when, and from where.',
  entities: ['activity_log', 'user'],

  render(ctx) {
    const { db, router } = ctx;
    const log = db.all('activity_log');
    const today = log.filter(a => a.created_at.slice(0, 10) === F.today());
    const byUser = db.groupBy(log, a => db.label('user', a.actor), {})
      .map(g => ({ label: g.key, value: g.count })).sort((a, b) => b.value - a.value);
    const byAction = db.groupBy(log, a => a.action, {})
      .map(g => ({ label: g.key, value: g.count })).sort((a, b) => b.value - a.value);

    const table = dataTable({
      rows: log,
      exportName: 'activity-log',
      defaultSort: 'created_at', defaultDir: 'desc',
      searchPlaceholder: 'Action, object or user…',
      columns: [
        { key: 'created_at', label: 'When', render: a => h('div',
          h('div', F.dateShort(a.created_at.slice(0, 10))),
          h('div.small.muted', `${F.time12(a.created_at.slice(11, 16))} · ${F.relative(a.created_at)}`)) },
        { key: 'actor', label: 'User', value: a => db.label('user', a.actor),
          render: a => h('div.row', { style: { gap: '8px' } },
            avatar(db.label('user', a.actor), true), h('span.small', db.label('user', a.actor))) },
        { key: 'action', label: 'Action', render: a => h('span.mono.small', a.action) },
        { key: 'detail', label: 'What happened' },
        { key: 'target_type', label: 'Object type', render: a => badge(F.titleCase(a.target_type)) },
        { key: 'target', label: 'Object', render: a => h('span.mono.small', a.target) },
        { key: 'ip_address', label: 'IP', render: a => h('span.mono.small.muted', a.ip_address) },
      ],
      filters: [
        { key: 'actor', label: 'Anyone', options: db.all('user').map(u => [u.pk, u.name]) },
        { key: 'target_type', label: 'Any object', options: [...new Set(log.map(a => a.target_type))].map(t => [t, F.titleCase(t)]) },
      ],
    });

    return h('div.page',
      pageHead({
        title: 'Activity Log',
        sub: 'Append-only. Nothing in this table can be edited or deleted from the dashboard.',
      }),
      moduleIntro(this, 'Every write through the data layer appends a row here automatically — including the ones you make while clicking around this prototype.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Events recorded', value: F.num(log.length) }),
        stat({ label: 'Today', value: F.num(today.length) }),
        stat({ label: 'Distinct users', value: F.num(new Set(log.map(a => a.actor)).size) }),
        stat({ label: 'Distinct actions', value: F.num(new Set(log.map(a => a.action)).size) })),
      h('div.grid.side.mb-4',
        card({ title: 'Most recent' }, timeline(log.slice(0, 8).map(a => ({
          title: `${db.label('user', a.actor)} ${a.detail}`,
          detail: `${a.action} · ${a.target}`,
          when: `${F.relative(a.created_at)} from ${a.ip_address}`,
          tone: a.action.includes('cancel') || a.action.includes('delete') ? 'danger'
            : a.action.includes('create') ? 'ok' : 'info',
        })))),
        h('div.col',
          card({ title: 'Busiest users' }, rankBars(byUser, { money: false, limit: 6 })),
          card({ title: 'Most common actions' }, rankBars(byAction, { money: false, limit: 6 })))),
      card({ flush: true }, table));
  },
};
