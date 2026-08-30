/** format.js — display formatting used everywhere. */

export const CURRENCY = { code: 'USD', symbol: '$' };

export function money(cents, { sign = false, blankZero = false } = {}) {
  if (cents == null || Number.isNaN(cents)) return '—';
  if (blankZero && cents === 0) return '—';
  const neg = cents < 0;
  const s = (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${neg ? '-' : sign ? '+' : ''}${CURRENCY.symbol}${s}`;
}
export function moneyShort(cents) {
  const v = (cents || 0) / 100;
  if (Math.abs(v) >= 1_000_000) return CURRENCY.symbol + (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1_000) return CURRENCY.symbol + (v / 1_000).toFixed(1) + 'k';
  return CURRENCY.symbol + v.toFixed(0);
}
export const num = (n) => (n ?? 0).toLocaleString('en-US');
export const pct = (n, digits = 0) => `${(n * 100).toFixed(digits)}%`;

/* ---------- dates: all internal dates are 'YYYY-MM-DD', times 'HH:MM' ---------- */
export const today = () => toISO(new Date());
export function toISO(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
export const pad = (n) => String(n).padStart(2, '0');
export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(iso, n) {
  const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d);
}
export function addMonths(iso, n) {
  const d = parseISO(iso); d.setMonth(d.getMonth() + n); return toISO(d);
}
export function diffDays(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
export function startOfWeek(iso) { return addDays(iso, -parseISO(iso).getDay()); }
export function startOfMonth(iso) { return iso.slice(0, 8) + '01'; }

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function dateShort(iso) { if (!iso) return '—'; const d = parseISO(iso); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
export function dateMed(iso)   { if (!iso) return '—'; const d = parseISO(iso); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; }
export function dateLong(iso)  { if (!iso) return '—'; const d = parseISO(iso); return `${DOW[d.getDay()]}, ${MONL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
export function monthLabel(iso){ const d = parseISO(iso); return `${MONL[d.getMonth()]} ${d.getFullYear()}`; }
export const monthName = (i) => MONL[i];
export const dowName = (i) => DOW[i];

export function time12(hhmm) {
  if (!hhmm) return '—';
  const [H, M] = hhmm.split(':').map(Number);
  const ap = H >= 12 ? 'pm' : 'am';
  const h = H % 12 === 0 ? 12 : H % 12;
  return `${h}:${pad(M)}${ap}`;
}
export function dateTime(iso, hhmm) { return `${dateShort(iso)} · ${time12(hhmm)}`; }

/** '2 hours ago', 'in 3 days' — relative to now. */
export function relative(isoDateTime) {
  const then = new Date(isoDateTime).getTime();
  if (Number.isNaN(then)) return '—';
  const secs = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(secs);
  const units = [[60,'second'],[3600,'minute'],[86400,'hour'],[604800,'day'],[2629800,'week'],[31557600,'month']];
  let n = abs, unit = 'year';
  for (let i = 0; i < units.length; i++) {
    if (abs < units[i][0]) { n = Math.round(abs / (i === 0 ? 1 : units[i-1][0])); unit = units[i][1]; break; }
    if (i === units.length - 1) { n = Math.round(abs / units[i][0]); unit = 'year'; }
  }
  const label = `${n} ${unit}${n === 1 ? '' : 's'}`;
  return secs < 0 ? `${label} ago` : `in ${label}`;
}

export function duration(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
export function titleCase(s) {
  return String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
export function truncate(s, n = 60) {
  s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
export function phone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : p || '—';
}
