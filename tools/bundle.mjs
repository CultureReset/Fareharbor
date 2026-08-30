#!/usr/bin/env node
/**
 * bundle.mjs — pack the whole prototype into one self-contained HTML file.
 *
 *   node tools/bundle.mjs > dist/prototype.html
 *
 * The app is plain ES modules, so there is nothing to transpile. This walks the
 * import graph from app/main.js, embeds every source file as a string, and at
 * runtime turns each one into a blob URL with its relative imports rewritten to
 * point at the blob of the module it wanted. Same modules, same semantics, one
 * file — and no build tooling in the repo the app itself depends on.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ---- walk the import graph, leaves first ---- */
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g;

const sources = new Map();
const order = [];
const visiting = new Set();

/**
 * Template literals in this codebase contain example code — the Platform Map
 * shows you how to write a module — so they have to be blanked out before
 * scanning, or the bundler chases imports that only exist in documentation.
 */
function stripTemplates(code) {
  let out = '', i = 0;
  while (i < code.length) {
    if (code[i] !== '`') { out += code[i++]; continue; }
    i++;                                   // opening backtick
    let depth = 0;
    while (i < code.length) {
      const c = code[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') out += '\n';
      if (depth === 0 && c === '`') { i++; break; }
      if (c === '$' && code[i + 1] === '{') { depth++; i += 2; continue; }
      if (depth > 0 && c === '}') { depth--; i++; continue; }
      i++;
    }
  }
  return out;
}

function depsOf(code) {
  const out = [];
  for (const m of stripTemplates(code).matchAll(IMPORT_RE)) out.push(m[1] || m[2]);
  return out;
}
const resolve = (from, spec) => normalize(join(dirname(from), spec)).replace(/\\/g, '/');

function visit(path) {
  if (sources.has(path)) return;
  if (visiting.has(path)) throw new Error(`Import cycle at ${path}`);
  visiting.add(path);
  const code = read(path);
  for (const spec of depsOf(code)) visit(resolve(path, spec));
  visiting.delete(path);
  sources.set(path, code);
  order.push(path);
}
visit('app/main.js');

/* ---- assemble ---- */
const css = ['styles/tokens.css', 'styles/base.css', 'styles/components.css']
  .map(read).join('\n');

// JSON.stringify does not escape "</script>", which would close the tag early.
const json = JSON.stringify(Object.fromEntries(sources)).replace(/<\//g, '<\\/');

process.stdout.write(`<title>FareHarbor Platform Map</title>
<meta name="description" content="A working map of the FareHarbor operator platform: every section, table and flow.">
<style>
${css}
</style>

<div id="root"></div>

<script type="module">
/* ${order.length} modules, packed by tools/bundle.mjs — see the repository for the
   unbundled source, one file per section under app/modules/. */
const SRC = ${json};
const ORDER = ${JSON.stringify(order)};

const dirname = (p) => p.slice(0, p.lastIndexOf('/'));
const resolve = (from, spec) => {
  const parts = (dirname(from) + '/' + spec).split('/');
  const out = [];
  for (const seg of parts) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
};

const urls = Object.create(null);
for (const path of ORDER) {
  const code = SRC[path].replace(
    /(from\\s*|import\\s*)(['"])(\\.{1,2}\\/[^'"]+)\\2/g,
    (m, kw, q, spec) => kw + q + urls[resolve(path, spec)] + q
  );
  urls[path] = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
}

import(urls['app/main.js']).catch((err) => {
  document.getElementById('root').innerHTML =
    '<pre style="padding:24px;white-space:pre-wrap;font:13px ui-monospace,monospace">'
    + String(err && err.stack || err) + '</pre>';
});
</script>
`);
