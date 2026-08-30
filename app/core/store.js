/**
 * store.js — minimal reactive store + event bus.
 * Modules never touch each other directly; they read state and emit events.
 */
export function createStore(initial = {}) {
  let state = { ...initial };
  const subs = new Set();
  const topics = new Map();

  const notify = (patch) => { for (const fn of [...subs]) fn(state, patch); };

  return {
    get state() { return state; },
    get(path, fallback) {
      return path.split('.').reduce((o, k) => (o == null ? o : o[k]), state) ?? fallback;
    },
    /** Shallow-merge a patch and notify subscribers. */
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      let changed = false;
      for (const k of Object.keys(next)) if (state[k] !== next[k]) { changed = true; break; }
      state = { ...state, ...next };
      if (changed) notify(next);
      return state;
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

    /* --- pub/sub bus, for cross-module signals like 'booking:created' --- */
    on(topic, fn) {
      if (!topics.has(topic)) topics.set(topic, new Set());
      topics.get(topic).add(fn);
      return () => topics.get(topic)?.delete(fn);
    },
    emit(topic, payload) {
      for (const fn of [...(topics.get(topic) || [])]) fn(payload);
      for (const fn of [...(topics.get('*') || [])]) fn({ topic, payload });
    },
  };
}

/** Persist a slice of state to localStorage (used for prefs only). */
export function persisted(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
export function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
