/** shell.js — the persistent chrome: brand bar, top bar, sidebar, global search. */
import { h, mount, dismissable } from '../dom.js';
import { btn, avatar } from './kit.js';
import { menu, modal, toast } from './overlay.js';
import { persist } from '../store.js';
import { initials } from '../format.js';

export function buildShell(ctx) {
  const { registry, router, store, db } = ctx;

  const root = h('div.app', { class: store.get('sidebarCollapsed') ? 'is-collapsed' : '' });
  const brandbar = h('div.brandbar');
  const topbar = h('div.topbar');
  const sidebar = h('div.sidebar');
  const main = h('div.main');
  root.append(brandbar, topbar, sidebar, main);

  /* ------------------------------------------------------------ brand */
  function renderBrand() {
    const co = db.all('company')[0];
    mount(brandbar, h('div.row', { style: { gap: '8px', minWidth: 0 } },
      h('div.logo', 'FH'),
      h('div.name', co?.name || 'FareHarbor'),
      h('div.spacer'),
      btn('', {
        kind: 'ghost', size: 'sm', icon: store.get('sidebarCollapsed') ? '»' : '«',
        title: 'Collapse navigation (\\)',
        onclick: toggleSidebar,
      })));
    brandbar.querySelector('.btn').style.color = '#8ea6bd';
  }

  function toggleSidebar() {
    const next = !store.get('sidebarCollapsed');
    store.set({ sidebarCollapsed: next });
    persist('fh.sidebarCollapsed', next);
    root.classList.toggle('is-collapsed', next);
    renderBrand();
  }

  /* ----------------------------------------------------------- topbar */
  function renderTop() {
    const me = store.get('currentUser');
    const co = db.all('company')[0];

    const searchWrap = h('div.searchbox');
    const searchInput = h('input.input', {
      type: 'search', placeholder: 'Search bookings, guests, items…  (/)',
      oninput: (e) => runSearch(e.target.value, searchWrap, searchInput),
      onfocus: (e) => { if (e.target.value) runSearch(e.target.value, searchWrap, searchInput); },
      onkeydown: (e) => {
        if (e.key === 'Escape') { e.target.blur(); searchWrap.querySelector('.omni')?.remove(); }
        if (e.key === 'Enter') searchWrap.querySelector('.omni__item')?.click();
      },
    });
    searchWrap.append(searchInput);

    mount(topbar, h('div.row', { style: { flex: 1, minWidth: 0 } },
      searchWrap,
      h('div.spacer'),
      btn('Book', {
        kind: 'primary', icon: '＋', title: 'Create a booking (B)',
        onclick: () => router.go('/book'),
      }),
      btn('', { kind: 'ghost', icon: '⌘', title: 'Command palette (Ctrl/⌘ K)', onclick: openPalette }),
      btn('', {
        kind: 'ghost', icon: store.get('theme') === 'dark' ? '☀' : '☾', title: 'Toggle theme (T)',
        onclick: toggleTheme,
      }),
      h('button.btn.ghost', {
        onclick: (e) => menu(e.currentTarget, [
          { label: me?.name || 'Signed in', icon: '👤' },
          { label: `Role: ${db.label('role', me?.role)}`, icon: '🔑' },
          'divider',
          { label: 'Company settings', icon: '⚙', onClick: () => router.go('/settings/company') },
          { label: 'Users & permissions', icon: '👥', onClick: () => router.go('/users') },
          { label: 'Switch acting user…', icon: '⇄', onClick: switchUser },
          'divider',
          { label: 'Reset demo data', icon: '↻', tone: 'danger', onClick: () => {
            db.reset(Math.floor(Math.random() * 1e8));
            toast('Demo data regenerated', { tone: 'ok' });
            router.go(router.current.path);
          } },
        ]),
      }, avatar(me?.name || '?', true), h('span.small', co?.shortname || ''))));
  }

  function switchUser() {
    modal({
      title: 'Act as another user',
      sub: 'Permissions in this prototype follow the selected role, so you can see what each teammate sees.',
      render: (api) => h('div.col',
        ...db.all('user').filter(u => u.status === 'active').map(u =>
          h('button.btn.block', {
            style: { justifyContent: 'flex-start', gap: '10px' },
            onclick: () => {
              store.set({ currentUser: u });
              api.close(); renderTop(); renderSidebar();
              toast(`Now acting as ${u.name}`, { detail: db.label('role', u.role), tone: 'ok' });
            },
          }, avatar(u.name, true), h('span', u.name),
             h('span.small.muted', { style: { marginLeft: 'auto' } }, db.label('role', u.role))))),
    });
  }

  function toggleTheme() {
    const next = store.get('theme') === 'dark' ? 'light' : 'dark';
    store.set({ theme: next });
    persist('fh.theme', next);
    document.documentElement.dataset.theme = next;
    renderTop();
  }

  /* ------------------------------------------------- global search */
  let searchTimer;
  function runSearch(q, wrap, input) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      wrap.querySelector('.omni')?.remove();
      if (!q || q.trim().length < 2) return;
      const results = registry.search(q, ctx);
      const box = h('div.omni');
      if (!results.length) {
        box.append(h('div.omni__item.muted', `No matches for “${q}”`));
      } else {
        const grouped = new Map();
        for (const r of results) {
          if (!grouped.has(r.moduleTitle)) grouped.set(r.moduleTitle, []);
          grouped.get(r.moduleTitle).push(r);
        }
        for (const [group, rs] of grouped) {
          box.append(h('div.omni__sec', group));
          for (const r of rs) {
            box.append(h('button.omni__item', {
              onclick: () => { box.remove(); input.value = ''; router.go(r.path); },
            }, h('span', r.icon || '•'),
               h('span', { style: { flex: 1, minWidth: 0 } },
                 h('div.strong', r.title),
                 r.sub && h('div.small.muted', r.sub)),
               r.kind && h('span.badge', r.kind)));
          }
        }
      }
      wrap.append(box);
      dismissable(wrap, () => box.remove());
    }, 160);
  }

  /* ------------------------------------------------ command palette */
  function openPalette() {
    let all = registry.commands(ctx);
    const list = h('div', { style: { maxHeight: '52vh', overflowY: 'auto' } });
    let active = 0, shown = all;

    const draw = (q) => {
      shown = q ? all.filter(c => (c.title + ' ' + (c.hint || '')).toLowerCase().includes(q.toLowerCase())) : all;
      shown = shown.slice(0, 60); active = 0;
      mount(list, h('div', ...shown.map((c, i) => h('button.omni__item', {
        class: i === active ? 'is-active' : '',
        onclick: () => { api.close(); c.run ? c.run() : router.go(c.path); },
      }, h('span', c.icon || '•'),
         h('span', { style: { flex: 1 } }, c.title),
         c.hint && h('span.small.muted', c.hint)))));
    };

    const input = h('input.input', {
      placeholder: 'Jump to anything…',
      oninput: (e) => draw(e.target.value),
      onkeydown: (e) => {
        const items = [...list.querySelectorAll('.omni__item')];
        if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); paint(items); e.preventDefault(); }
        if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); paint(items); e.preventDefault(); }
        if (e.key === 'Enter') items[active]?.click();
      },
    });
    const paint = (items) => {
      items.forEach((el, i) => el.classList.toggle('is-active', i === active));
      items[active]?.scrollIntoView({ block: 'nearest' });
    };

    const api = modal({
      title: 'Command palette',
      sub: 'Every section and every quick action, from the keyboard.',
      render: () => h('div.col', input, list),
    });
    draw('');
    setTimeout(() => input.focus(), 30);
  }

  /* ---------------------------------------------------------- sidebar */
  function renderSidebar() {
    const activeId = router.current.module;
    mount(sidebar, h('div', ...registry.nav().map(({ group, items }) =>
      h('nav.nav-group',
        h('div.nav-group__label', group),
        ...items.map(m => {
          const count = typeof m.badge === 'function' ? m.badge(ctx) : null;
          return h('a.nav-item', {
            class: m.id === activeId ? 'is-active' : '', href: `#/${m.id}`, title: m.title,
          }, h('span.ico', m.icon), h('span.lbl', m.title),
             count ? h('span.cnt', count > 99 ? '99+' : String(count)) : null);
        })))));
  }

  /* -------------------------------------------------------- shortcuts */
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); topbar.querySelector('input')?.focus(); }
    if (e.key === 'b') { e.preventDefault(); router.go('/book'); }
    if (e.key === 't') { e.preventDefault(); toggleTheme(); }
    if (e.key === '\\') { e.preventDefault(); toggleSidebar(); }
    if (e.key === 'g') {
      const once = (e2) => {
        document.removeEventListener('keydown', once, true);
        const map = { h: 'home', b: 'bookings', c: 'calendar', i: 'items', r: 'reports', s: 'settings', t: 'today' };
        if (map[e2.key]) { e2.preventDefault(); router.go('/' + map[e2.key]); }
      };
      document.addEventListener('keydown', once, true);
    }
  });

  return {
    root, main,
    render() { renderBrand(); renderTop(); renderSidebar(); },
    refreshNav: renderSidebar,
    openPalette,
  };
}
