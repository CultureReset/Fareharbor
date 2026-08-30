/**
 * router.js — hash router.  #/<module>/<sub>/<id>?a=1&b=2
 * The whole app is addressable: every table filter, tab and record
 * lives in the URL so any screen can be linked to or reloaded.
 */
export function createRouter(onChange) {
  const parse = () => {
    const raw = location.hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
    const query = {};
    new URLSearchParams(queryPart || '').forEach((v, k) => { query[k] = v; });
    return {
      segments,
      module: segments[0] || 'home',
      sub: segments[1] || null,
      id: segments[2] || null,
      rest: segments.slice(3),
      query,
      path: '/' + segments.join('/'),
    };
  };

  let current = parse();
  const fire = () => { current = parse(); onChange(current); };
  window.addEventListener('hashchange', fire);

  return {
    get current() { return current; },
    start() { if (!location.hash) location.hash = '#/home'; else fire(); },
    /** Navigate. `query` replaces the querystring entirely. */
    go(path, query) {
      const qs = query && Object.keys(query).length
        ? '?' + new URLSearchParams(
            Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString()
        : '';
      const next = '#' + (path.startsWith('/') ? path : '/' + path) + qs;
      if (location.hash === next) fire(); else location.hash = next;
    },
    /** Merge keys into the current querystring without leaving the page. */
    patchQuery(patch, { replace = true } = {}) {
      const q = { ...current.query, ...patch };
      for (const k of Object.keys(q)) if (q[k] === '' || q[k] == null) delete q[k];
      const qs = new URLSearchParams(q).toString();
      const next = '#' + current.path + (qs ? '?' + qs : '');
      if (replace) { history.replaceState(null, '', next); current = parse(); onChange(current, true); }
      else location.hash = next;
    },
    href(path, query) {
      const qs = query ? '?' + new URLSearchParams(query).toString() : '';
      return '#' + (path.startsWith('/') ? path : '/' + path) + qs;
    },
  };
}
