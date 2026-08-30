/**
 * table.js — the DataTable every list screen is built from.
 *
 * It owns its own sort/search/filter/page/selection state and re-renders in
 * place, so a module just declares columns and hands it rows.
 *
 *   dataTable({
 *     rows: () => db.query('booking', {...}),   // or a plain array
 *     columns: [
 *       { key:'code', label:'Confirmation', render: r => ... , sortable:true },
 *       { key:'total', label:'Total', align:'num', fmt: money },
 *     ],
 *     filters: [{ key:'status', label:'Status', options:[...] }],
 *     onRowClick: r => openDrawer(r),
 *     selectable: true,
 *     bulkActions: (selected) => [ btn(...) ],
 *     totals: rows => ({ total: sum }),
 *   })
 */
import { h, mount } from '../dom.js';
import { btn, empty, select as selectEl } from './kit.js';
import { num } from '../format.js';
import { toast } from './overlay.js';

export function dataTable(cfg) {
  const {
    columns, rows, filters = [], searchable = true, searchPlaceholder = 'Search…',
    onRowClick, selectable = false, bulkActions, toolbar, totals,
    emptyTitle = 'Nothing here yet', emptySub, emptyAction,
    pageSize: initialPageSize = 25, defaultSort = null, defaultDir = 'asc',
    exportName = 'export', dense = false, rowClass, onStateChange, initialState = {},
  } = cfg;

  const state = {
    search: '', sort: defaultSort, dir: defaultDir, page: 1,
    pageSize: initialPageSize, filters: {}, selected: new Set(), ...initialState,
  };

  const host = h('div.dt');

  function resolve() {
    const res = typeof rows === 'function' ? rows(state) : rows;
    // A caller can either do its own querying (returning {rows,total,allRows})
    // or hand over a plain array and let the table do the work.
    if (Array.isArray(res)) return localQuery(res);
    return { ...res, allRows: res.allRows || res.rows };
  }

  function localQuery(all) {
    let list = all;
    for (const [k, v] of Object.entries(state.filters)) {
      if (v === '' || v == null) continue;
      const fdef = filters.find(f => f.key === k);
      list = fdef?.apply ? list.filter(r => fdef.apply(r, v)) : list.filter(r => String(r[k]) === String(v));
    }
    const q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter(r => columns.some(c => {
        const v = c.value ? c.value(r) : r[c.key];
        return v != null && String(v).toLowerCase().includes(q);
      }));
    }
    if (state.sort) {
      const col = columns.find(c => c.key === state.sort);
      list = [...list].sort((a, b) => {
        const av = col?.value ? col.value(a) : a[state.sort];
        const bv = col?.value ? col.value(b) : b[state.sort];
        if (av == null) return 1; if (bv == null) return -1;
        const c = typeof av === 'number' && typeof bv === 'number'
          ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
        return state.dir === 'desc' ? -c : c;
      });
    }
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    const page = Math.min(state.page, pages);
    return {
      rows: state.pageSize ? list.slice((page - 1) * state.pageSize, page * state.pageSize) : list,
      total, page, pages, allRows: list,
    };
  }

  function setState(patch) {
    Object.assign(state, patch);
    if (!('page' in patch)) state.page = 1;
    onStateChange?.(state);
    render();
  }

  function exportCsv(allRows) {
    const cols = columns.filter(c => c.export !== false);
    const head = cols.map(c => `"${String(c.label).replace(/"/g, '""')}"`).join(',');
    const body = allRows.map(r => cols.map(c => {
      const v = c.value ? c.value(r) : r[c.key];
      const s = c.exportFmt ? c.exportFmt(r) : (v == null ? '' : String(v));
      return `"${s.replace(/"/g, '""')}"`;
    }).join(',')).join('\n');
    const blob = new Blob([head + '\n' + body], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${exportName}.csv` });
    document.body.append(a); a.click(); a.remove();
    toast('Export ready', { detail: `${allRows.length} rows written to ${exportName}.csv`, tone: 'ok' });
  }

  function render() {
    const { rows: page, total, page: pageNo, pages, allRows } = resolve();
    const cols = columns.filter(c => !c.hidden);

    const toolbarEl = h('div.dt__toolbar',
      searchable && h('div.dt__search',
        h('input.input', {
          type: 'search', placeholder: searchPlaceholder, value: state.search,
          oninput: (e) => { state.search = e.target.value; state.page = 1; onStateChange?.(state); rerenderBody(); },
        })),
      ...filters.map(f => h('div', { style: { minWidth: '130px' } },
        selectEl([['', f.label], ...f.options], state.filters[f.key] ?? '',
          (v) => setState({ filters: { ...state.filters, [f.key]: v } })))),
      Object.values(state.filters).some(v => v !== '' && v != null) &&
        btn('Clear', { kind: 'ghost', size: 'sm', onclick: () => setState({ filters: {}, search: '' }) }),
      h('div.spacer'),
      selectable && state.selected.size > 0 && h('div.row',
        h('span.small.strong', `${state.selected.size} selected`),
        ...(bulkActions ? bulkActions([...state.selected], () => setState({ selected: new Set() })) : []),
        btn('Clear', { kind: 'ghost', size: 'sm', onclick: () => setState({ selected: new Set() }) })),
      ...(toolbar || []),
      btn('Export CSV', { size: 'sm', icon: '↓', onclick: () => exportCsv(allRows) }));

    const allOnPageSelected = page.length > 0 && page.every(r => state.selected.has(r.pk));

    const thead = h('thead', h('tr',
      selectable && h('th', { style: { width: '34px' } },
        h('input', {
          type: 'checkbox', checked: allOnPageSelected,
          onchange: (e) => {
            page.forEach(r => e.target.checked ? state.selected.add(r.pk) : state.selected.delete(r.pk));
            render();
          },
        })),
      ...cols.map(c => h('th', {
        class: [c.align === 'num' ? 'num' : '', c.sortable !== false ? 'sortable' : '',
                state.sort === c.key ? 'is-sorted' : ''].filter(Boolean).join(' '),
        style: c.width ? { width: c.width } : null,
        onclick: c.sortable === false ? null : () => setState({
          sort: c.key, dir: state.sort === c.key && state.dir === 'asc' ? 'desc' : 'asc', page: 1,
        }),
      }, c.label, c.sortable !== false && h('span.arrow',
        state.sort === c.key ? (state.dir === 'asc' ? '▲' : '▼') : '⇅')))));

    const tbody = h('tbody', ...page.map(r => h('tr', {
      class: [onRowClick ? 'clickable' : '', state.selected.has(r.pk) ? 'is-selected' : '',
              rowClass ? rowClass(r) : ''].filter(Boolean).join(' '),
      onclick: onRowClick ? (e) => { if (!e.target.closest('input,button,a')) onRowClick(r); } : null,
    },
      selectable && h('td', { style: { width: '34px' } },
        h('input', {
          type: 'checkbox', checked: state.selected.has(r.pk),
          onchange: (e) => { e.target.checked ? state.selected.add(r.pk) : state.selected.delete(r.pk); render(); },
        })),
      ...cols.map(c => h('td', {
        class: c.align === 'num' ? 'num' : '',
        style: c.nowrap ? { whiteSpace: 'nowrap' } : null,
      }, c.render ? c.render(r) : fmtCell(c, r))))));

    const totalsRow = totals && page.length ? (() => {
      const t = totals(allRows);
      return h('tfoot', h('tr',
        selectable && h('td'),
        ...cols.map((c, i) => h('td', { class: c.align === 'num' ? 'num' : '' },
          i === 0 && !(c.key in t) ? `${num(allRows.length)} rows` : (t[c.key] ?? '')))));
    })() : null;

    const bodyWrap = h('div',
      page.length === 0
        ? empty(emptyTitle, emptySub, emptyAction)
        : h('div.dt__scroll', h('table.dt__table', { style: dense ? { fontSize: 'var(--fs-sm)' } : null },
            thead, tbody, totalsRow)),
      h('div.dt__foot',
        h('span.small.muted', total === 0 ? 'No results'
          : `${num((pageNo - 1) * state.pageSize + 1)}–${num(Math.min(pageNo * state.pageSize, total))} of ${num(total)}`),
        h('div.spacer'),
        h('span.small.muted', 'Rows'),
        selectEl([25, 50, 100, 250], state.pageSize, (v) => setState({ pageSize: Number(v) }),
          { style: 'width:78px;padding:3px 22px 3px 8px;font-size:var(--fs-sm)' }),
        h('div.btn-group',
          btn('‹', { size: 'sm', disabled: pageNo <= 1, onclick: () => setState({ page: pageNo - 1 }) }),
          btn(`${pageNo} / ${pages}`, { size: 'sm', disabled: true }),
          btn('›', { size: 'sm', disabled: pageNo >= pages, onclick: () => setState({ page: pageNo + 1 }) }))));

    mount(host, h('div', toolbarEl, bodyWrap));
    // keep focus in the search box while typing
    if (document.activeElement === document.body && state.search) {
      const inp = host.querySelector('.dt__search input');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  }

  let bodyTimer = null;
  function rerenderBody() { clearTimeout(bodyTimer); bodyTimer = setTimeout(render, 130); }

  render();
  host.refresh = render;
  host.state = state;
  return host;
}

function fmtCell(col, row) {
  const v = col.value ? col.value(row) : row[col.key];
  if (v == null || v === '') return '—';
  return col.fmt ? col.fmt(v, row) : String(v);
}
