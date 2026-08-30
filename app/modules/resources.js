import { h } from '../core/dom.js';
import { pageHead, card, btn, badge, statusBadge, stat, empty, select, simpleTable, kv, meter } from '../core/ui/kit.js';
import { dataTable } from '../core/ui/table.js';
import { drawer, modal, toast, confirm } from '../core/ui/overlay.js';
import { moduleIntro } from './_shared.js';
import * as F from '../core/format.js';

export default {
  id: 'resources',
  title: 'Resources',
  icon: '🚐',
  group: 'Operations',
  order: 70,
  summary: 'Boats, vans, gear and guides — what exists, what is assigned to which departure, and what clashes.',
  entities: ['resource', 'resource_assignment', 'availability'],

  badge: (ctx) => ctx.domain.unassignedDepartures(F.today(), F.addDays(F.today(), 7)).length || null,

  render(ctx) {
    const { db, domain, router, route } = ctx;
    const date = route.query.date || F.today();
    const resources = db.all('resource');
    const dayAvs = db.where('availability', a => a.date === date && a.status !== 'cancelled')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const assignments = db.all('resource_assignment');
    const unassigned = domain.unassignedDepartures(date, date);

    /* clash detection: one resource on two overlapping departures */
    const clashes = [];
    for (const r of resources) {
      const mine = assignments.filter(a => a.resource === r.pk && a.status !== 'released')
        .map(a => ({ a, av: db.get('availability', a.availability) }))
        .filter(x => x.av && x.av.date === date)
        .sort((x, y) => x.av.start_time.localeCompare(y.av.start_time));
      for (let i = 1; i < mine.length; i++) {
        if (mine[i].av.start_time < mine[i - 1].av.end_time) {
          clashes.push({ resource: r, a: mine[i - 1].av, b: mine[i].av });
        }
      }
    }

    const table = dataTable({
      rows: resources,
      exportName: 'resources',
      defaultSort: 'kind',
      searchPlaceholder: 'Search resources…',
      onRowClick: (r) => openResource(ctx, r),
      columns: [
        { key: 'name', label: 'Resource', render: r => h('div',
          h('div.strong', r.name), h('div.small.muted', db.label('location', r.location))) },
        { key: 'kind', label: 'Type', render: r => badge(F.titleCase(r.kind)) },
        { key: 'capacity', label: 'Capacity', align: 'num' },
        { key: 'status', label: 'Status', render: r => statusBadge(r.status) },
        { key: 'assigned', label: 'Assignments (next 14d)', align: 'num',
          value: r => assignments.filter(a => a.resource === r.pk && (db.get('availability', a.availability)?.date || '') >= F.today()).length },
        { key: 'notes', label: 'Notes', render: r => h('span.small.muted', F.truncate(r.notes, 50)) },
      ],
      filters: [
        { key: 'kind', label: 'Any type', options: ['vessel', 'vehicle', 'equipment', 'staff', 'room'].map(k => [k, F.titleCase(k)]) },
        { key: 'status', label: 'Any status', options: ['available', 'in_use', 'maintenance', 'retired'].map(k => [k, F.titleCase(k)]) },
      ],
    });

    /* day grid: departures × assigned resources */
    const grid = card({
      title: 'Assignment board',
      sub: `${F.dateLong(date)} — ${dayAvs.length} departures`,
      actions: [
        h('div.btn-group',
          btn('‹', { size: 'sm', onclick: () => router.patchQuery({ date: F.addDays(date, -1) }) }),
          btn('Today', { size: 'sm', onclick: () => router.patchQuery({ date: F.today() }) }),
          btn('›', { size: 'sm', onclick: () => router.patchQuery({ date: F.addDays(date, 1) }) })),
      ],
      flush: true,
    }, dayAvs.length ? simpleTable(
      ['Time', 'Item', { label: 'Pax', align: 'num' }, 'Assigned', ''],
      dayAvs.map(av => {
        const mine = assignments.filter(a => a.availability === av.pk);
        return [
          h('span.strong.nowrap', F.time12(av.start_time)),
          h('div', h('div', db.label('item', av.item)), h('div.small.muted', `${av.booked}/${av.capacity} seats`)),
          av.booked,
          mine.length
            ? h('div.row', { style: { gap: '4px' } }, ...mine.map(a => {
                const r = db.get('resource', a.resource);
                return h('span.chip', r?.name, h('button', {
                  title: 'Release', onclick: (e) => { e.stopPropagation(); db.remove('resource_assignment', a.pk); toast('Released'); },
                }, '×'));
              }))
            : (av.booked > 0 ? badge('Nothing assigned', 'danger') : h('span.muted', '—')),
          btn('Assign', { size: 'sm', kind: av.booked > 0 && !mine.length ? 'primary' : '', onclick: () => assignTo(ctx, av) }),
        ];
      })) : empty('Nothing scheduled', `No departures on ${F.dateLong(date)}.`));

    return h('div.page',
      pageHead({
        title: 'Resources',
        sub: 'The finite things a departure consumes. Assignments here surface on the manifest and flag clashes.',
        actions: [btn('New resource', { kind: 'primary', icon: '＋', onclick: () => newResource(ctx) })],
      }),
      moduleIntro(this, 'A departure can consume several resources at once — a boat, a van and a lead guide. Nothing stops you overbooking a resource, but every clash is called out.'),
      h('div.grid.c4.mb-4',
        stat({ label: 'Resources', value: F.num(resources.length) }),
        stat({ label: 'Out of service', value: F.num(resources.filter(r => r.status === 'maintenance' || r.status === 'retired').length),
          tone: resources.some(r => r.status === 'maintenance') ? 'warn' : null }),
        stat({ label: 'Unassigned departures today', value: F.num(unassigned.length), tone: unassigned.length ? 'danger' : null }),
        stat({ label: 'Clashes today', value: F.num(clashes.length), tone: clashes.length ? 'danger' : null })),

      clashes.length ? h('div.banner.danger.mb-4', h('span', '⚠'),
        h('div', h('div.strong', `${clashes.length} double-booked resource${clashes.length === 1 ? '' : 's'}`),
          ...clashes.slice(0, 4).map(c => h('div.small',
            `${c.resource.name}: ${F.time12(c.a.start_time)}–${F.time12(c.a.end_time)} overlaps ${F.time12(c.b.start_time)}`)))) : null,

      resources.filter(r => r.status === 'maintenance').length ? h('div.banner.warn.mb-4', h('span', '🔧'),
        h('div', h('div.strong', 'In maintenance'),
          h('div.small', resources.filter(r => r.status === 'maintenance').map(r => `${r.name} — ${r.notes || 'no note'}`).join(' · ')))) : null,

      grid,
      h('div.mt-4', card({ title: 'All resources', flush: true }, table)));
  },
};

function assignTo(ctx, av) {
  const { db } = ctx;
  const item = db.get('item', av.item);
  const taken = new Set(db.children('resource_assignment', 'availability', av.pk).map(a => a.resource));
  const options = db.where('resource', r => r.status !== 'retired' && !taken.has(r.pk));
  let pick = options[0]?.pk, role = 'Primary craft', status = 'assigned';
  modal({
    title: 'Assign a resource',
    sub: `${item?.name} — ${F.dateMed(av.date)} at ${F.time12(av.start_time)} (${av.booked} guests)`,
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Resource'),
        select(options.map(r => [r.pk, `${r.name} — ${F.titleCase(r.kind)}, capacity ${r.capacity}${r.status === 'maintenance' ? ' (IN MAINTENANCE)' : ''}`]), pick, v => { pick = v; })),
      h('div.field', h('label', 'Role'),
        select(['Primary craft', 'Support craft', 'Lead guide', 'Second guide', 'Driver', 'Fleet'], role, v => { role = v; })),
      h('div.field', h('label', 'Status'),
        select([['assigned', 'Confirmed'], ['tentative', 'Tentative']], status, v => { status = v; }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Assign', { kind: 'primary', disabled: !options.length, onclick: () => {
        db.insert('resource_assignment', { resource: pick, availability: av.pk, role, status });
        api.close(); toast(`${db.label('resource', pick)} assigned`, { tone: 'ok' });
      } })],
  });
}

function openResource(ctx, r) {
  const { db } = ctx;
  const upcoming = db.where('resource_assignment', a => a.resource === r.pk)
    .map(a => ({ a, av: db.get('availability', a.availability) }))
    .filter(x => x.av && x.av.date >= F.today())
    .sort((x, y) => (x.av.date + x.av.start_time).localeCompare(y.av.date + y.av.start_time));
  drawer({
    title: r.name,
    sub: `${F.titleCase(r.kind)} · capacity ${r.capacity} · ${db.label('location', r.location)}`,
    badge: statusBadge(r.status),
    render: (api) => h('div.col', { style: { gap: 'var(--sp-4)' } },
      card({ title: 'Details' }, h('div.grid.c2',
        h('div.field', h('label', 'Name'), h('input.input', { value: r.name, onchange: e => db.update('resource', r.pk, { name: e.target.value }) })),
        h('div.field', h('label', 'Type'), select(['vessel', 'vehicle', 'equipment', 'staff', 'room'], r.kind, v => db.update('resource', r.pk, { kind: v }))),
        h('div.field', h('label', 'Capacity'), h('input.input', { type: 'number', value: r.capacity, onchange: e => db.update('resource', r.pk, { capacity: Number(e.target.value) }) })),
        h('div.field', h('label', 'Status'), select(['available', 'in_use', 'maintenance', 'retired'], r.status, v => { db.update('resource', r.pk, { status: v }); api.refresh(); })),
        h('div.field', h('label', 'Home location'), select(db.all('location').map(l => [l.pk, l.name]), r.location, v => db.update('resource', r.pk, { location: v }))),
        h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Notes'),
          h('textarea.textarea', { value: r.notes || '', onchange: e => db.update('resource', r.pk, { notes: e.target.value }) })))),
      card({ title: `Upcoming assignments (${upcoming.length})`, flush: true },
        upcoming.length ? simpleTable(['Date', 'Time', 'Item', 'Role', 'Status', ''],
          upcoming.slice(0, 30).map(x => [
            F.dateMed(x.av.date), F.time12(x.av.start_time), db.label('item', x.av.item),
            x.a.role, statusBadge(x.a.status),
            btn('Release', { size: 'sm', kind: 'ghost', onclick: () => { db.remove('resource_assignment', x.a.pk); api.refresh(); } }),
          ])) : empty('Not assigned to anything upcoming'))),
    foot: (api) => [btn('Delete resource', { kind: 'danger', onclick: () => confirm({
      title: `Delete ${r.name}?`, body: 'Existing assignments are removed too.', confirmLabel: 'Delete', tone: 'danger',
      onConfirm: () => {
        db.where('resource_assignment', a => a.resource === r.pk).forEach(a => db.remove('resource_assignment', a.pk, { log: false }));
        db.remove('resource', r.pk); api.close(); toast('Resource deleted', { tone: 'ok' });
      },
    }) })],
  });
}

function newResource(ctx) {
  const { db } = ctx;
  const draft = { name: '', kind: 'vessel', capacity: 12, location: db.all('location')[0]?.pk, status: 'available', notes: '' };
  modal({
    title: 'New resource',
    render: () => h('div.grid.c2',
      h('div.field', { style: { gridColumn: '1 / -1' } }, h('label', 'Name'),
        h('input.input', { placeholder: 'MV Second Wind', oninput: e => { draft.name = e.target.value; } })),
      h('div.field', h('label', 'Type'), select(['vessel', 'vehicle', 'equipment', 'staff', 'room'], draft.kind, v => { draft.kind = v; })),
      h('div.field', h('label', 'Capacity'), h('input.input', { type: 'number', value: draft.capacity, oninput: e => { draft.capacity = Number(e.target.value); } })),
      h('div.field', h('label', 'Home location'), select(db.all('location').map(l => [l.pk, l.name]), draft.location, v => { draft.location = v; }))),
    foot: (api) => [btn('Cancel', { onclick: api.close }),
      btn('Create', { kind: 'primary', onclick: () => {
        if (!draft.name.trim()) return toast('Name it first', { tone: 'warn' });
        db.insert('resource', { company: ctx.domain.company().pk, ...draft });
        api.close(); toast('Resource added', { tone: 'ok' });
      } })],
  });
}
