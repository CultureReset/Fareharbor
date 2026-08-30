import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, avatar } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { modal, toast } from '../core/ui/overlay.js';
import { openBooking, moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'tasks',
  title: 'Tasks',
  icon: '✅',
  group: 'Overview',
  order: 30,
  summary: "The team's shared worklist: unpaid balances, missing waivers, callbacks and maintenance.",
  entities: ['task', 'booking', 'user'],

  badge: (ctx) => ctx.db.where('task', t => t.status === 'open').length || null,

  render(ctx) {
    const { db, router, store } = ctx;
    const tasks = db.all('task');
    const me = store.get('currentUser');
    const open = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');
    const overdue = open.filter(t => t.due_date < F.today());
    const mine = open.filter(t => t.assignee === me?.pk);

    const newTask = () => {
      const draft = { title: '', kind: 'other', assignee: me?.pk, due_date: F.today(), priority: 'normal' };
      modal({
        title: 'New task',
        render: () => h('div.grid.c2',
          h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'What needs doing?'),
            h('input.input', { placeholder: 'Call the Riverwalk Inn about Saturday', oninput: (e) => { draft.title = e.target.value; } })),
          h('div.field', h('label', 'Type'),
            select(['balance_due', 'waiver_missing', 'callback', 'maintenance', 'review', 'other'], draft.kind, v => { draft.kind = v; })),
          h('div.field', h('label', 'Priority'),
            select(['low', 'normal', 'high', 'urgent'], draft.priority, v => { draft.priority = v; })),
          h('div.field', h('label', 'Assignee'),
            select(db.where('user', u => u.status === 'active').map(u => [u.pk, u.name]), draft.assignee, v => { draft.assignee = v; })),
          h('div.field', h('label', 'Due'),
            h('input.input', { type: 'date', value: draft.due_date, onchange: (e) => { draft.due_date = e.target.value; } }))),
        foot: (api) => [
          btn('Cancel', { onclick: api.close }),
          btn('Create task', { kind: 'primary', onclick: () => {
            if (!draft.title.trim()) return toast('Give the task a title', { tone: 'warn' });
            db.insert('task', { company: ctx.domain.company().pk, booking: null, status: 'open', ...draft });
            api.close(); toast('Task created', { tone: 'ok' });
          } }),
        ],
      });
    };

    const table = dataTable({
      rows: tasks,
      defaultSort: 'due_date',
      exportName: 'tasks',
      searchPlaceholder: 'Search tasks…',
      columns: [
        { key: 'status', label: '', width: '34px', sortable: false, render: t =>
          h('input', { type: 'checkbox', checked: t.status === 'done',
            onchange: (e) => db.update('task', t.pk, { status: e.target.checked ? 'done' : 'open' }) }) },
        { key: 'title', label: 'Task', render: t => h('div',
          h('div', { style: { textDecoration: t.status === 'done' ? 'line-through' : null, opacity: t.status === 'done' ? .6 : 1 } }, t.title),
          t.booking && h('a.small', { href: `#/bookings/detail/${t.booking}` }, db.label('booking', t.booking))) },
        { key: 'kind', label: 'Type', render: t => badge(F.titleCase(t.kind)) },
        { key: 'priority', label: 'Priority', render: t => statusBadge(t.priority) },
        { key: 'assignee', label: 'Assignee', value: t => db.label('user', t.assignee),
          render: t => h('div.row', { style: { gap: '6px' } }, avatar(db.label('user', t.assignee), true),
            h('span.small', db.label('user', t.assignee))) },
        { key: 'due_date', label: 'Due', render: t => h('span', {
            style: { color: t.due_date < F.today() && t.status !== 'done' ? 'var(--danger)' : null, fontWeight: t.due_date < F.today() ? 600 : 400 },
          }, F.dateShort(t.due_date)) },
        { key: 'status2', label: 'Status', value: t => t.status, sortable: false, render: t => statusBadge(t.status) },
      ],
      filters: [
        { key: 'status', label: 'Any status', options: ['open', 'in_progress', 'done', 'dismissed'].map(s => [s, F.titleCase(s)]) },
        { key: 'priority', label: 'Any priority', options: ['urgent', 'high', 'normal', 'low'].map(s => [s, F.titleCase(s)]) },
        { key: 'assignee', label: 'Anyone', options: db.all('user').map(u => [u.pk, u.name]) },
        { key: 'kind', label: 'Any type', options: ['balance_due', 'waiver_missing', 'callback', 'maintenance', 'review', 'other'].map(s => [s, F.titleCase(s)]) },
      ],
      selectable: true,
      bulkActions: (sel, clear) => [
        btn('Mark done', { size: 'sm', onclick: () => { sel.forEach(pk => db.update('task', pk, { status: 'done' })); clear(); toast(`${sel.length} tasks closed`, { tone: 'ok' }); } }),
        btn('Reassign to me', { size: 'sm', onclick: () => { sel.forEach(pk => db.update('task', pk, { assignee: me.pk })); clear(); } }),
      ],
      onRowClick: (t) => { if (t.booking) openBooking(ctx, t.booking); },
    });

    return h('div.page',
      pageHead({
        title: 'Tasks',
        sub: 'Follow-ups the team owes. Some are generated from booking state, some are typed in by hand.',
        actions: [btn('New task', { kind: 'primary', icon: '＋', onclick: newTask })],
      }),
      moduleIntro(this),
      h('div.grid.c4.mb-4',
        stat({ label: 'Open', value: F.num(open.length) }),
        stat({ label: 'Overdue', value: F.num(overdue.length), tone: overdue.length ? 'danger' : null }),
        stat({ label: 'Assigned to me', value: F.num(mine.length) }),
        stat({ label: 'Closed', value: F.num(tasks.filter(t => t.status === 'done').length) })),
      card({ flush: true }, table));
  },
};
