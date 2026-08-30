/**
 * dom.js — tiny hyperscript layer.
 * No framework, no build step. h() returns real DOM nodes.
 *
 *   h('div.card', { onclick: fn }, h('h3', 'Title'), 'text')
 *   h('input.input', { value: 'x', attrs: { type: 'date' } })
 *
 * Supported props:
 *   class / className : string | string[] | {name: bool}
 *   style             : object of CSS props
 *   on<Event>         : function  (onclick, oninput, onchange, onkeydown, ...)
 *   html              : raw innerHTML (use only for trusted, internal markup)
 *   dataset           : object -> data-* attributes
 *   attrs             : object -> setAttribute for anything else
 *   ref               : function called with the element
 *   any other key     : set as a DOM property when it exists, else an attribute
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg','g','path','rect','circle','line','polyline','polygon','text','tspan',
  'defs','linearGradient','stop','ellipse','clipPath','use','title'
]);

export function h(spec, props, ...children) {
  // "div.card.pad#main" -> tag + classes + id
  let tag = 'div', cls = [], id = null;
  if (typeof spec === 'function') return spec(props || {}, children);
  const m = String(spec).match(/^([a-zA-Z0-9-]*)((?:[.#][^.#]+)*)$/);
  if (m) {
    if (m[1]) tag = m[1];
    (m[2].match(/[.#][^.#]+/g) || []).forEach(tok => {
      if (tok[0] === '.') cls.push(tok.slice(1)); else id = tok.slice(1);
    });
  } else tag = spec;

  const el = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  if (id) el.id = id;
  if (cls.length) el.setAttribute('class', cls.join(' '));

  if (props && (typeof props !== 'object' || Array.isArray(props) || props instanceof Node)) {
    children.unshift(props); props = null;
  }

  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class' || k === 'className') {
        const extra = normalizeClass(v);
        el.setAttribute('class', [...cls, ...extra].join(' '));
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v);
      } else if (k === 'html') {
        el.innerHTML = v;
      } else if (k === 'dataset') {
        for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      } else if (k === 'attrs') {
        for (const [ak, av] of Object.entries(v)) {
          if (av === false || av == null) continue;
          el.setAttribute(ak, av === true ? '' : av);
        }
      } else if (k === 'ref' && typeof v === 'function') {
        v(el);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (!SVG_TAGS.has(tag) && k in el) {
        try { el[k] = v; } catch { el.setAttribute(k, v); }
      } else {
        el.setAttribute(k, v === true ? '' : v);
      }
    }
  }

  append(el, children);
  return el;
}

function normalizeClass(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap(normalizeClass);
  if (typeof v === 'object') return Object.entries(v).filter(([, on]) => on).map(([n]) => n);
  return String(v).split(/\s+/).filter(Boolean);
}

export function append(parent, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false || kid === true) continue;
    parent.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return parent;
}

/** Replace all children of `host` with `node`. */
export function mount(host, node) {
  host.replaceChildren();
  if (node) append(host, [node]);
  return host;
}

/** Fragment helper — group nodes without a wrapper element. */
export function frag(...children) {
  return append(document.createDocumentFragment(), children);
}

/** Escape a string for safe interpolation into `html:` props. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Close-on-outside-click / Escape helper used by menus and popovers. */
export function dismissable(el, onDismiss) {
  const away = (e) => { if (!el.contains(e.target)) { cleanup(); onDismiss(); } };
  const key = (e) => { if (e.key === 'Escape') { cleanup(); onDismiss(); } };
  const cleanup = () => {
    document.removeEventListener('mousedown', away, true);
    document.removeEventListener('keydown', key, true);
  };
  setTimeout(() => {
    document.addEventListener('mousedown', away, true);
    document.addEventListener('keydown', key, true);
  }, 0);
  return cleanup;
}
