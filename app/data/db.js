/**
 * db.js — an in-memory database with the query surface the UI needs.
 *
 * Modules never reach into raw arrays; they call query()/get()/rel(). That means
 * the same screens work unchanged if the arrays are later swapped for fetch()
 * against a real API — only this file would change.
 */
import { generate } from './seed.js';
import { SCHEMA, TABLES } from './schema.js';

/** Human-readable label for a row, per table. Used anywhere a ref is displayed. */
const LABELERS = {
  company: r => r.name, location: r => r.name, user: r => r.name, role: r => r.name,
  item: r => r.name, customer_type: r => r.singular, contact: r => r.name,
  booking: r => r.code, affiliate: r => r.name, channel: r => r.name,
  resource: r => r.name, lodging: r => r.name, promo_code: r => r.code,
  gift_card: r => r.code, membership_type: r => r.name, waiver_template: r => r.name,
  message_template: r => r.name, cancellation_policy: r => r.name, tax_fee: r => r.name,
  payout: r => r.reference, widget: r => r.name, api_key: r => r.name,
  availability: r => `${r.date} ${r.start_time}`,
  customer_type_rate: r => r.pk, booking_customer: r => r.name,
  custom_field: r => r.title, saved_report: r => r.name, task: r => r.title,
};

export function createDb(store, seed = 20260830) {
  const data = generate(seed);
  for (const t of SCHEMA) data[t.id] ||= [];

  // pk -> row, per table
  const index = {};
  const reindex = (t) => { index[t] = new Map(data[t].map(r => [r.pk, r])); };
  for (const t of Object.keys(data)) reindex(t);

  let uid = 900000;
  const nextPk = (t) => `${t}_${++uid}`;

  const db = {
    /* ------------------------------------------------------------ read */
    tables: () => SCHEMA.map(t => t.id),
    all: (t) => data[t] || [],
    count: (t) => (data[t] || []).length,
    get: (t, pk) => (pk == null ? null : index[t]?.get(pk) || null),
    find: (t, pred) => (data[t] || []).find(pred) || null,
    where: (t, pred) => (data[t] || []).filter(typeof pred === 'function' ? pred : matcher(pred)),

    /** Resolve a foreign key: rel(booking, 'item') -> the item row. */
    rel(row, fieldName) {
      if (!row) return null;
      const tableId = tableOf(row);
      const fl = TABLES[tableId]?.fields.find(f => f.name === fieldName);
      if (!fl?.ref) return null;
      return db.get(fl.ref, row[fieldName]);
    },
    /** Rows in `t` whose `fieldName` points at `pk`. */
    children: (t, fieldName, pk) => (data[t] || []).filter(r => r[fieldName] === pk),

    /** Display label for a row or a (table, pk) pair. */
    label(t, pkOrRow) {
      const row = typeof pkOrRow === 'string' ? db.get(t, pkOrRow) : pkOrRow;
      if (!row) return '—';
      return String((LABELERS[t] || (r => r.name || r.title || r.pk))(row));
    },

    /**
     * The workhorse. Returns { rows, total, page, pages }.
     *   filter : object of field->value | [values] | {op:'gte'|'lte'|'between'|'ne'|'in', value}
     *            or a predicate function
     *   search : substring match across `searchFields` (defaults to every text-ish field)
     *   sort   : field name, `dir` 'asc'|'desc'
     *   page / pageSize : 1-based; pageSize 0 disables paging
     */
    query(t, {
      filter = null, search = '', searchFields = null,
      sort = null, dir = 'asc', page = 1, pageSize = 25,
    } = {}) {
      let rows = data[t] || [];

      if (filter) rows = rows.filter(typeof filter === 'function' ? filter : matcher(filter));

      const q = String(search || '').trim().toLowerCase();
      if (q) {
        const fields = searchFields || defaultSearchFields(t);
        rows = rows.filter(r => fields.some(fn => {
          const v = r[fn];
          if (v == null) return false;
          return String(Array.isArray(v) ? v.join(' ') : v).toLowerCase().includes(q);
        }));
      }

      const total = rows.length;
      if (sort) {
        const numeric = isNumericField(t, sort);
        rows = [...rows].sort((a, b) => {
          const av = a[sort], bv = b[sort];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          const c = numeric ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
          return dir === 'desc' ? -c : c;
        });
      }

      const pages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
      const p = Math.min(Math.max(1, page), pages);
      const paged = pageSize ? rows.slice((p - 1) * pageSize, p * pageSize) : rows;
      return { rows: paged, total, page: p, pages, allRows: rows };
    },

    /** Group rows and reduce — the primitive behind every report. */
    groupBy(rows, keyFn, reducers) {
      const groups = new Map();
      for (const r of rows) {
        const k = keyFn(r);
        if (k == null) continue;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      return [...groups.entries()].map(([key, items]) => {
        const acc = { key, count: items.length, items };
        for (const [name, fn] of Object.entries(reducers || {})) acc[name] = fn(items);
        return acc;
      });
    },
    sum: (rows, field) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0),

    /* ----------------------------------------------------------- write */
    insert(t, row, { log = true } = {}) {
      const rec = { pk: row.pk || nextPk(t), ...row };
      (data[t] ||= []).push(rec);
      (index[t] ||= new Map()).set(rec.pk, rec);
      if (log) audit('create', t, rec);
      store?.emit('db:change', { table: t, op: 'insert', row: rec });
      return rec;
    },
    update(t, pk, patch, { log = true } = {}) {
      const rec = db.get(t, pk);
      if (!rec) return null;
      Object.assign(rec, patch);
      if (log) audit('update', t, rec, Object.keys(patch).join(', '));
      store?.emit('db:change', { table: t, op: 'update', row: rec });
      return rec;
    },
    remove(t, pk, { log = true } = {}) {
      const i = (data[t] || []).findIndex(r => r.pk === pk);
      if (i < 0) return false;
      const [rec] = data[t].splice(i, 1);
      index[t].delete(pk);
      if (log) audit('delete', t, rec);
      store?.emit('db:change', { table: t, op: 'delete', row: rec });
      return true;
    },

    /** Reset to a fresh generated dataset (used by the Reset demo data action). */
    reset(newSeed = seed) {
      const fresh = generate(newSeed);
      for (const k of Object.keys(data)) delete data[k];
      Object.assign(data, fresh);
      for (const t of SCHEMA) data[t.id] ||= [];
      for (const t of Object.keys(data)) reindex(t);
      store?.emit('db:reset', {});
    },

    /** Raw export, used by the CSV/JSON download buttons. */
    dump: () => data,
  };

  function tableOf(row) {
    return String(row.pk || '').replace(/_\d+$/, '');
  }
  function audit(action, t, rec, detail = '') {
    if (t === 'activity_log') return;
    const me = store?.get('currentUser');
    data.activity_log?.unshift({
      pk: nextPk('activity_log'),
      company: data.company[0]?.pk,
      actor: me?.pk || null,
      action: `${t}.${action}`,
      target_type: t,
      target: db.label(t, rec),
      detail: detail || `${action}d ${TABLES[t]?.label || t}`,
      created_at: new Date().toISOString().slice(0, 19),
      ip_address: '10.0.0.12',
    });
    if (index.activity_log) index.activity_log.set(data.activity_log[0].pk, data.activity_log[0]);
  }

  return db;
}

/* -------------------------------------------------------------- helpers */
function matcher(spec) {
  const entries = Object.entries(spec).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return (row) => entries.every(([k, v]) => {
    const rv = row[k];
    if (Array.isArray(v)) return v.length === 0 || v.includes(rv);
    if (v && typeof v === 'object' && 'op' in v) {
      switch (v.op) {
        case 'gte': return rv >= v.value;
        case 'lte': return rv <= v.value;
        case 'gt':  return rv > v.value;
        case 'lt':  return rv < v.value;
        case 'ne':  return rv !== v.value;
        case 'in':  return (v.value || []).includes(rv);
        case 'between': return rv >= v.value[0] && rv <= v.value[1];
        case 'contains': return String(rv ?? '').toLowerCase().includes(String(v.value).toLowerCase());
        case 'truthy': return !!rv;
        case 'falsy': return !rv;
        default: return true;
      }
    }
    return rv === v;
  });
}

const TEXTY = new Set(['string', 'text', 'email', 'phone', 'url', 'slug', 'enum', 'id']);
function defaultSearchFields(t) {
  return (TABLES[t]?.fields || []).filter(f => TEXTY.has(f.type)).map(f => f.name);
}
const NUMERIC = new Set(['money', 'int', 'float', 'pct']);
function isNumericField(t, name) {
  return NUMERIC.has(TABLES[t]?.fields.find(f => f.name === name)?.type);
}
