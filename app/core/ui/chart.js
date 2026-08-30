/** chart.js — small dependency-free SVG charts, theme-aware via currentColor/vars. */
import { h } from '../dom.js';
import { moneyShort, num } from '../format.js';

const SERIES = ['var(--primary)', 'var(--purple)', 'var(--ok)', 'var(--warn)', 'var(--brand-cyan)', 'var(--danger)', 'var(--neutral)'];
export const seriesColor = (i) => SERIES[i % SERIES.length];

export function sparkline(values, { w = 120, h: ht = 28, tone = 'var(--primary)', fill = true } = {}) {
  if (!values?.length) return h('div');
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / Math.max(1, values.length - 1)) * w,
    ht - ((v - min) / span) * (ht - 3) - 1.5,
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return h('svg', { attrs: { viewBox: `0 0 ${w} ${ht}`, width: w, height: ht, preserveAspectRatio: 'none' } },
    fill && h('path', { attrs: { d: `${d} L${w},${ht} L0,${ht} Z`, fill: tone, opacity: '.12' } }),
    h('path', { attrs: { d, fill: 'none', stroke: tone, 'stroke-width': '1.6', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } }));
}

/** Vertical bars with an axis. data: [{label, value}] */
export function barChart(data, { height = 200, money = true, tone = 'var(--primary)', maxBars = 40 } = {}) {
  const rows = data.slice(0, maxBars);
  if (!rows.length) return h('div.dt__empty', 'No data in this range');
  const max = Math.max(...rows.map(r => r.value), 1);
  const gridVals = [0, .25, .5, .75, 1].map(f => max * f);
  return h('div',
    h('div', { style: { display: 'flex', gap: '2px', alignItems: 'flex-end', height: `${height}px`, position: 'relative', borderBottom: '1px solid var(--border)' } },
      ...gridVals.map(g => h('div', {
        style: {
          position: 'absolute', left: 0, right: 0, bottom: `${(g / max) * 100}%`,
          borderTop: '1px dashed var(--border)', pointerEvents: 'none',
        },
      }, h('span', { style: { position: 'absolute', right: 0, bottom: '2px', fontSize: '10px', color: 'var(--fg-subtle)' } },
        money ? moneyShort(g) : num(Math.round(g))))),
      ...rows.map(r => h('div', {
        style: { flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minWidth: '3px', height: '100%' },
        title: `${r.label}: ${money ? moneyShort(r.value) : num(r.value)}`,
      }, h('div', {
        style: {
          height: `${Math.max(1, (r.value / max) * 100)}%`, background: r.tone || tone,
          borderRadius: '2px 2px 0 0', opacity: r.dim ? '.4' : '1', transition: 'height .3s',
        },
      })))),
    h('div', { style: { display: 'flex', gap: '2px', marginTop: '4px' } },
      ...rows.map((r, i) => h('div', {
        style: {
          flex: '1', fontSize: '9px', color: 'var(--fg-subtle)', textAlign: 'center',
          overflow: 'hidden', whiteSpace: 'nowrap',
        },
      }, rows.length > 20 ? (i % 5 === 0 ? r.short ?? r.label : '') : (r.short ?? r.label)))));
}

/** Horizontal ranked bars — the shape most report breakdowns want. */
export function rankBars(rows, { money = true, limit = 10 } = {}) {
  const top = rows.slice(0, limit);
  if (!top.length) return h('div.dt__empty', 'No data');
  const max = Math.max(...top.map(r => r.value), 1);
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
    ...top.map((r, i) => h('div',
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' } },
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' } }, r.label),
        h('span', { style: { fontWeight: '600', fontVariantNumeric: 'tabular-nums' } }, money ? moneyShort(r.value) : num(r.value))),
      h('div', { style: { height: '7px', background: 'var(--surface-3)', borderRadius: '999px', overflow: 'hidden' } },
        h('div', { style: { width: `${(r.value / max) * 100}%`, height: '100%', background: r.tone || seriesColor(i), borderRadius: '999px' } })))));
}

/** Donut with a centre label. data: [{label, value}] */
export function donut(data, { size = 150, thickness = 22, centerLabel, centerSub } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = data.map((d, i) => {
    const len = (d.value / total) * circ;
    const el = h('circle', {
      attrs: {
        cx, cy, r, fill: 'none', stroke: d.tone || seriesColor(i), 'stroke-width': thickness,
        'stroke-dasharray': `${len} ${circ - len}`, 'stroke-dashoffset': -offset,
        transform: `rotate(-90 ${cx} ${cy})`,
      },
    }, h('title', `${d.label}: ${d.value}`));
    offset += len;
    return el;
  });
  return h('div', { style: { position: 'relative', width: `${size}px`, height: `${size}px` } },
    h('svg', { attrs: { width: size, height: size, viewBox: `0 0 ${size} ${size}` } },
      h('circle', { attrs: { cx, cy, r, fill: 'none', stroke: 'var(--surface-3)', 'stroke-width': thickness } }),
      ...arcs),
    centerLabel && h('div', {
      style: {
        position: 'absolute', inset: 0, display: 'grid', placeContent: 'center',
        textAlign: 'center', lineHeight: '1.2',
      },
    }, h('div', { style: { fontSize: '20px', fontWeight: '700' } }, centerLabel),
       centerSub && h('div', { style: { fontSize: '11px', color: 'var(--fg-muted)' } }, centerSub)));
}

export const legend = (data) =>
  h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px' } },
    ...data.map((d, i) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
      h('i', { style: { width: '9px', height: '9px', borderRadius: '2px', background: d.tone || seriesColor(i), display: 'inline-block' } }),
      h('span', d.label),
      d.value != null && h('span', { style: { color: 'var(--fg-muted)' } }, String(d.value)))));

/** Stacked horizontal bar — good for channel mix / status mix in one line. */
export function stackedBar(data, { height = 10 } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return h('div', { style: { display: 'flex', height: `${height}px`, borderRadius: '999px', overflow: 'hidden', background: 'var(--surface-3)' } },
    ...data.map((d, i) => h('div', {
      style: { width: `${(d.value / total) * 100}%`, background: d.tone || seriesColor(i) },
      title: `${d.label}: ${d.value}`,
    })));
}

/** Heatmap grid — used for capacity utilisation by weekday × hour. */
export function heatmap(cells, { cols, rowLabels, colLabels, format = num }) {
  const max = Math.max(...cells.map(c => c.value), 1);
  return h('div', { style: { overflowX: 'auto' } },
    h('div', { style: { display: 'grid', gridTemplateColumns: `auto repeat(${cols}, minmax(28px,1fr))`, gap: '2px', minWidth: '420px' } },
      h('div'),
      ...colLabels.map(l => h('div', { style: { fontSize: '10px', color: 'var(--fg-subtle)', textAlign: 'center' } }, l)),
      ...rowLabels.flatMap((rl, ri) => [
        h('div', { style: { fontSize: '11px', color: 'var(--fg-muted)', paddingRight: '6px', display: 'grid', alignItems: 'center' } }, rl),
        ...Array.from({ length: cols }, (_, ci) => {
          const c = cells.find(x => x.row === ri && x.col === ci) || { value: 0 };
          const a = c.value / max;
          return h('div', {
            style: {
              aspectRatio: '1', borderRadius: '3px', minHeight: '22px',
              background: a === 0 ? 'var(--surface-3)' : `color-mix(in srgb, var(--primary) ${Math.round(a * 100)}%, transparent)`,
            },
            title: `${rl} ${colLabels[ci]}: ${format(c.value)}`,
          });
        }),
      ])));
}
