/**
 * registry.js — the modularity seam.
 *
 * Every section of the dashboard is an independent module object. Nothing in the
 * shell knows the name of any section: the sidebar, the router, the command
 * palette and the global search are all derived from whatever is registered.
 *
 * A module looks like this:
 *
 *   export default {
 *     id:      'bookings',            // URL segment, must be unique
 *     title:   'Bookings',            // sidebar + page label
 *     icon:    '🎟',                  // sidebar glyph
 *     group:   'Operations',          // sidebar section heading
 *     order:   20,                    // sort order inside the group
 *     hidden:  false,                 // reachable by URL but not in the sidebar
 *     summary: 'What this section does',
 *     entities: ['booking','customer'],// tables this section reads/writes (docs)
 *     badge:   (ctx) => 12 | null,    // optional sidebar counter
 *     subnav:  (ctx) => [{ id, title }],
 *     render:  (ctx) => Node,         // required
 *     search:  (q, ctx) => [{ title, sub, path, kind }],
 *     commands:(ctx) => [{ title, path, run }],
 *   }
 *
 * To add a section: drop a file in app/modules/, add it to MODULES in main.js.
 * To remove one: delete the import. Nothing else changes.
 */

export function createRegistry() {
  const byId = new Map();

  return {
    register(mod) {
      if (!mod || !mod.id) throw new Error('Module needs an id');
      if (typeof mod.render !== 'function') throw new Error(`Module "${mod.id}" needs render()`);
      byId.set(mod.id, { group: 'General', order: 100, icon: '•', ...mod });
      return this;
    },
    registerAll(mods) { mods.forEach(m => this.register(m)); return this; },
    get(id) { return byId.get(id); },
    has(id) { return byId.has(id); },
    all() { return [...byId.values()]; },

    /** Sidebar tree: [{ group, items: [module] }] in declared group order. */
    nav() {
      const groups = new Map();
      for (const m of byId.values()) {
        if (m.hidden) continue;
        if (!groups.has(m.group)) groups.set(m.group, []);
        groups.get(m.group).push(m);
      }
      return [...groups.entries()].map(([group, items]) => ({
        group,
        items: items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
      }));
    },

    /** Fan a query out to every module that opts into global search. */
    search(q, ctx, limit = 24) {
      if (!q || q.trim().length < 1) return [];
      const out = [];
      for (const m of byId.values()) {
        if (typeof m.search !== 'function') continue;
        try {
          for (const r of (m.search(q, ctx) || [])) {
            out.push({ module: m.id, moduleTitle: m.title, icon: m.icon, ...r });
          }
        } catch (e) { console.warn(`search failed in ${m.id}`, e); }
      }
      return out.slice(0, limit);
    },

    /** Command palette entries: navigation for every module + module-supplied verbs. */
    commands(ctx) {
      const out = [];
      for (const m of byId.values()) {
        out.push({ title: `Go to ${m.title}`, hint: m.group, path: `/${m.id}`, icon: m.icon });
        if (typeof m.commands === 'function') {
          try { for (const c of (m.commands(ctx) || [])) out.push({ icon: m.icon, hint: m.title, ...c }); }
          catch (e) { console.warn(`commands failed in ${m.id}`, e); }
        }
      }
      return out;
    },
  };
}
