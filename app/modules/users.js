import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, toggle, tabs, avatar, checkbox } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

/** The permission surface, grouped the way the settings screen groups it. */
const PERMISSIONS = [
  ['Bookings', [
    ['bookings.view', 'See bookings'],
    ['bookings.create', 'Create bookings'],
    ['bookings.edit', 'Edit and move bookings'],
    ['bookings.cancel', 'Cancel bookings'],
  ]],
  ['Money', [
    ['payments.charge', 'Take payments'],
    ['payments.refund', 'Issue refunds'],
    ['payments.view', 'See transactions'],
    ['payouts.view', 'See payouts and bank details'],
  ]],
  ['Catalog', [
    ['items.view', 'See items'],
    ['items.edit', 'Edit items and pricing'],
    ['availability.edit', 'Add and change departures'],
  ]],
  ['Operations', [
    ['manifest.view', 'See manifests'],
    ['checkin.edit', 'Check guests in'],
    ['resources.edit', 'Assign resources'],
  ]],
  ['Guests', [
    ['contacts.view', 'See contact records'],
    ['contacts.edit', 'Edit and merge contacts'],
    ['messaging.send', 'Send guest messages'],
  ]],
  ['Administration', [
    ['reports.view', 'Run reports'],
    ['exports.create', 'Export data'],
    ['users.manage', 'Manage users and roles'],
    ['settings.manage', 'Change company settings'],
  ]],
];

const has = (role, key) => {
  const p = role?.permissions || [];
  if (p.includes('*')) return true;
  if (p.includes(key)) return true;
  const [area, verb] = key.split('.');
  if (p.includes(`${area}.*`)) return true;
  if (p.includes('*.view') && verb === 'view') return true;
  return false;
};

export default {
  id: 'users',
  title: 'Users & Roles',
  icon: '👥',
  group: 'Admin',
  order: 220,
  summary: 'Who can log in, what each role may do, and the permission matrix behind it.',
  entities: ['user', 'role'],

  render(ctx) {
    const { db, router, route, store } = ctx;
    const tab = route.query.tab || 'users';
    const users = db.all('user');
    const roles = db.all('role');
    const me = store.get('currentUser');

    const TABS = [
      { id: 'users', title: 'Users', count: users.length },
      { id: 'roles', title: 'Roles', count: roles.length },
      { id: 'matrix', title: 'Permission matrix' },
    ];

    const panes = {
      users: () => card({ flush: true }, dataTable({
        rows: users,
        exportName: 'users',
        searchPlaceholder: 'Name, email or role…',
        onRowClick: (u) => openUser(ctx, u),
        columns: [
          { key: 'name', label: 'User', render: u => h('div.row', { style: { gap: '9px' } },
            avatar(u.name, true),
            h('div', h('div.strong', u.name, u.pk === me?.pk ? h('span.small.muted', ' (you)') : null),
              h('div.small.muted', u.email))) },
          { key: 'role', label: 'Role', value: u => db.label('role', u.role),
            render: u => badge(db.label('role', u.role), 'info') },
          { key: 'status', label: 'Status', render: u => statusBadge(u.status) },
          { key: 'two_factor', label: '2FA', render: u => u.two_factor ? badge('On', 'ok', true) : badge('Off', 'warn', true) },
          { key: 'location_scope', label: 'Restricted to', sortable: false,
            render: u => u.location_scope?.length
              ? h('span.small', u.location_scope.map(l => db.label('location', l)).join(', '))
              : h('span.muted.small', 'All locations') },
          { key: 'last_login', label: 'Last seen', render: u => h('span.small', F.relative(u.last_login)) },
        ],
        filters: [
          { key: 'role', label: 'Any role', options: roles.map(r => [r.pk, r.name]) },
          { key: 'status', label: 'Any status', options: ['active', 'invited', 'disabled'].map(s => [s, F.titleCase(s)]) },
        ],
      })),

      roles: () => h('div.grid.c2', ...roles.map(r => card({
        title: r.name,
        sub: `${r.user_count} ${r.user_count === 1 ? 'user' : 'users'}`,
        actions: [r.is_system ? badge('Built-in') : btn('Edit', { size: 'sm', onclick: () => editRole(ctx, r) })],
      },
        h('p.small.muted', r.description),
        h('div.mt-3', h('div.small.strong.mb-2', 'Grants'),
          h('div.row', { style: { gap: '4px' } },
            ...(r.permissions.includes('*')
              ? [badge('Everything', 'purple')]
              : r.permissions.slice(0, 8).map(p => badge(p))))),
        h('div.mt-3.row',
          ...users.filter(u => u.role === r.pk).slice(0, 6).map(u => avatar(u.name, true)),
          users.filter(u => u.role === r.pk).length > 6
            ? h('span.small.muted', `+${users.filter(u => u.role === r.pk).length - 6}`) : null))),
        card({ title: 'Add a role' },
          h('p.small.muted', 'Roles bundle permissions. A user has exactly one role, optionally narrowed to specific locations.'),
          h('div.mt-3', btn('New role', { kind: 'primary', onclick: () => editRole(ctx, null) })))),

      matrix: () => card({ title: 'Permission matrix', sub: 'Every permission against every role', flush: true },
        simpleTable(
          ['Permission', ...roles.map(r => ({ label: r.name, align: 'num' }))],
          PERMISSIONS.flatMap(([group, perms]) => [
            [h('span.small.strong', { style: { textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-subtle)' } }, group),
             ...roles.map(() => '')],
            ...perms.map(([key, label]) => [
              h('div', h('div', label), h('div.small.mono.subtle', key)),
              ...roles.map(r => has(r, key)
                ? h('span', { style: { color: 'var(--ok)', fontWeight: 700 } }, '✓')
                : h('span.subtle', '·')),
            ]),
          ]))),
    };

    return h('div.page',
      pageHead({
        title: 'Users & Roles',
        sub: 'Access control for the dashboard.',
        actions: [btn('Invite a user', { kind: 'primary', icon: '＋', onclick: () => inviteUser(ctx) })],
      }),
      moduleIntro(this, 'Try the “Act as another user” option in the account menu to see the dashboard as a guide or an accountant rather than an owner.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Users', value: F.num(users.length) }),
        stat({ label: 'Active', value: F.num(users.filter(u => u.status === 'active').length) }),
        stat({ label: 'Pending invitations', value: F.num(users.filter(u => u.status === 'invited').length) }),
        stat({ label: '2FA coverage',
          value: F.pct(users.length ? users.filter(u => u.two_factor).length / users.length : 0, 0),
          tone: users.filter(u => u.two_factor).length < users.length ? 'warn' : 'ok' })),
      tabs(TABS, tab, id => router.patchQuery({ tab: id })),
      h('div.mt-4', panes[tab]()));
  },
};

function openUser(ctx, u) {
  const { db, store } = ctx;
  const role = db.get('role', u.role);
  drawer({
    title: u.name,
    sub: u.email,
    badge: statusBadge(u.status),
    render: (api) => h('div.col', { style: { gap: 'var(--sp-4)' } },
      card({ title: 'Account' }, h('div.grid.c2',
        h('div.field', h('label', 'Name'), h('input.input', { value: u.name, onchange: e => db.update('user', u.pk, { name: e.target.value }) })),
        h('div.field', h('label', 'Email'), h('input.input', { value: u.email, onchange: e => db.update('user', u.pk, { email: e.target.value }) })),
        h('div.field', h('label', 'Phone'), h('input.input', { value: u.phone || '', onchange: e => db.update('user', u.pk, { phone: e.target.value }) })),
        h('div.field', h('label', 'Role'),
          select(db.all('role').map(r => [r.pk, r.name]), u.role, v => { db.update('user', u.pk, { role: v }); api.refresh(); })),
        h('div.field', h('label', 'Status'),
          select(['active', 'invited', 'disabled'], u.status, v => { db.update('user', u.pk, { status: v }); api.refresh(); })),
        h('div.field', h('label', 'Two-factor authentication'),
          toggle(u.two_factor, v => db.update('user', u.pk, { two_factor: v }))))),
      card({ title: 'Location restriction' },
        h('p.small.muted', 'Leave everything unticked to give this user access to every location.'),
        h('div.col.mt-2', ...db.all('location').map(l =>
          checkbox(l.name, (u.location_scope || []).includes(l.pk), v => {
            const next = v ? [...(u.location_scope || []), l.pk] : (u.location_scope || []).filter(x => x !== l.pk);
            db.update('user', u.pk, { location_scope: next });
          })))),
      card({ title: `What ${u.name.split(' ')[0]} can do`, sub: role?.name },
        h('div.col', ...PERMISSIONS.map(([group, perms]) => h('div',
          h('div.small.strong.mb-2', group),
          h('div.row', { style: { gap: '4px' } },
            ...perms.map(([key, label]) => badge(label, has(role, key) ? 'ok' : ''))))))),
      card({ title: 'Recent activity', flush: true },
        (() => {
          const log = db.where('activity_log', a => a.actor === u.pk).slice(0, 12);
          return log.length ? simpleTable(['When', 'Action', 'Object'],
            log.map(a => [h('span.small', F.relative(a.created_at)), a.detail, h('span.small.mono', a.target)]))
            : empty('No recorded activity');
        })())),
    foot: (api) => [
      btn('Act as this user', { onclick: () => {
        store.set({ currentUser: u }); api.close();
        toast(`Now acting as ${u.name}`, { detail: db.label('role', u.role), tone: 'ok' });
        location.reload();
      } }),
      u.status !== 'disabled'
        ? btn('Disable access', { kind: 'danger', onclick: () => confirm({
            title: `Disable ${u.name}?`, body: 'They are signed out immediately and cannot sign back in.',
            confirmLabel: 'Disable', tone: 'danger',
            onConfirm: () => { db.update('user', u.pk, { status: 'disabled' }); api.refresh(); toast('Access disabled'); },
          }) })
        : btn('Re-enable', { kind: 'primary', onclick: () => { db.update('user', u.pk, { status: 'active' }); api.refresh(); } }),
    ],
  });
}

function inviteUser(ctx) {
  const { db } = ctx;
  const roles = db.all('role');
  const d = { name: '', email: '', role: roles[2]?.pk || roles[0]?.pk };
  modal({
    title: 'Invite a user',
    sub: 'They get an email with a link to set a password. Nothing is visible to them until they accept.',
    render: () => h('div.grid.c2',
      h('div.field', h('label', 'Name'), h('input.input', { oninput: e => { d.name = e.target.value; } })),
      h('div.field', h('label', 'Email'), h('input.input', { type: 'email', oninput: e => { d.email = e.target.value; } })),
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Role'),
        select(roles.map(r => [r.pk, `${r.name} — ${r.description}`]), d.role, v => { d.role = v; }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Send invitation', { kind: 'primary', onclick: () => {
        if (!d.name.trim() || !d.email.trim()) return toast('Name and email are required', { tone: 'warn' });
        db.insert('user', { company: ctx.domain.company().pk, ...d, phone: '', status: 'invited',
          last_login: new Date().toISOString().slice(0, 19), two_factor: false, location_scope: [] });
        const r = db.get('role', d.role);
        db.update('role', d.role, { user_count: r.user_count + 1 }, { log: false });
        api.close(); toast(`Invitation sent to ${d.email}`, { tone: 'ok' });
      } })],
  });
}

function editRole(ctx, r) {
  const { db } = ctx;
  const d = r ? { ...r, permissions: [...r.permissions] } : { name: '', description: '', permissions: [], is_system: false, user_count: 0 };
  modal({
    title: r ? `Edit ${r.name}` : 'New role',
    width: 'wide',
    render: (api) => h('div.col',
      h('div.grid.c2',
        h('div.field', h('label', 'Role name'), h('input.input', { value: d.name, oninput: e => { d.name = e.target.value; } })),
        h('div.field', h('label', 'Description'), h('input.input', { value: d.description, oninput: e => { d.description = e.target.value; } }))),
      h('div.mt-4', ...PERMISSIONS.map(([group, perms]) => h('div.mb-3',
        h('div.small.strong.mb-2', group),
        h('div.grid.c2', ...perms.map(([key, label]) =>
          checkbox(label, d.permissions.includes(key), v => {
            d.permissions = v ? [...d.permissions, key] : d.permissions.filter(x => x !== key);
          })))))),
    ),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn(r ? 'Save role' : 'Create role', { kind: 'primary', onclick: () => {
        if (!d.name.trim()) return toast('Name the role', { tone: 'warn' });
        if (r) db.update('role', r.pk, d);
        else db.insert('role', { company: ctx.domain.company().pk, ...d });
        api.close(); toast('Saved', { tone: 'ok' });
      } })],
  });
}
