#!/usr/bin/env node
/**
 * gen-docs.mjs — regenerate docs/DATA-MODEL.md from app/data/schema.js.
 *
 *   node tools/gen-docs.mjs > docs/DATA-MODEL.md
 *
 * The document cannot drift from the code because it is the code, printed.
 */
import { SCHEMA, GROUPS, relationships, dependents } from '../app/data/schema.js';

const edges = relationships();
const out = [];
const w = (s = '') => out.push(s);
const anchor = (id) => {
  const t = SCHEMA.find(x => x.id === id);
  return `#${id}--${t.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
};

w('# Data Model');
w();
w('Generated from [`app/data/schema.js`](../app/data/schema.js) — the same declaration the');
w('application runs on. Regenerate it with `node tools/gen-docs.mjs > docs/DATA-MODEL.md`');
w('after editing the schema.');
w();
w(`**${SCHEMA.length} tables · ${SCHEMA.reduce((s, t) => s + t.fields.length, 0)} fields · ${edges.length} foreign keys**`);
w();
w('---');
w();
w('## The spine');
w();
w('> An **item** is a product; it generates dated **availability** rows; a guest books one,');
w('> producing a **booking** that holds a **booking_customer** per seat and a **payment** per');
w('> transaction; payments settle in a **payout**.');
w();
w('```');
w('  item ──< availability ──< booking ──< booking_customer');
w('                              │  │');
w('                              │  ├──< custom_field_value');
w('                              │  ├──< waiver_signature');
w('                              │  ├──< note');
w('                              │  └──< message_log');
w('                              │');
w('                              ├──< payment ──> payout');
w('                              ├──> contact');
w('                              ├──> channel');
w('                              ├──> affiliate');
w('                              ├──> promo_code');
w('                              └──> lodging');
w('```');
w();
w('Read `──<` as "has many" and `──>` as "belongs to".');
w();
w('Three joins are worth internalising, because most screens are one of them:');
w();
w('| Screen | Join |');
w('|---|---|');
w('| A manifest | `availability → booking → booking_customer`, plus `waiver_signature`, `custom_field_value`, `note` |');
w('| A guest history | `contact → booking → item`, plus `payment` and `membership` |');
w('| A payout statement | `payout → payment → booking → item` |');
w();
w('---');
w();
w('## Conventions');
w();
w('Two rules run through the whole schema:');
w();
w('- **Money is always integer cents.** `5200` is $52.00. There are no floats in');
w('  any money field, so totals never drift.');
w('- **Dates and times are always strings.** `date` is `YYYY-MM-DD`, `time` is');
w('  `HH:MM`, `datetime` is `YYYY-MM-DDTHH:MM:SS`. They sort and compare');
w('  lexicographically and never carry a surprise timezone.');
w();
w('### Field types');
w();
w('| Type | Meaning |');
w('|---|---|');
[
  ['id', 'Primary key. String, prefixed with the table name.'],
  ['ref', 'Foreign key. The `ref` property names the target table.'],
  ['string', 'Short text.'],
  ['text', 'Long text, rendered multi-line.'],
  ['email', 'Email address.'],
  ['phone', 'Phone number, formatted on display.'],
  ['url', 'Absolute URL.'],
  ['slug', 'URL-safe identifier.'],
  ['money', 'Integer cents.'],
  ['int', 'Whole number.'],
  ['float', 'Decimal number.'],
  ['pct', 'Fraction in 0..1. `0.15` renders as 15%.'],
  ['bool', 'True or false.'],
  ['date', '`YYYY-MM-DD`, no time, no zone.'],
  ['time', '`HH:MM`, 24-hour, local to the company timezone.'],
  ['datetime', '`YYYY-MM-DDTHH:MM:SS`.'],
  ['enum', 'One of a fixed set, listed in the `enum` property.'],
  ['json', 'Nested structure.'],
  ['array', 'List of scalars or references.'],
].forEach(([t, d]) => w(`| \`${t}\` | ${d} |`));
w();
w('---');
w();
w('## Tables by group');
w();
for (const g of GROUPS) {
  const rows = SCHEMA.filter(t => t.group === g.id);
  if (!rows.length) continue;
  w(`### ${g.id}`);
  w();
  w(`_${g.desc}_`);
  w();
  for (const t of rows) {
    w(`#### \`${t.id}\` — ${t.label}`);
    w();
    w(t.desc);
    w();
    w('| Field | Type | Label | References | Values / notes |');
    w('|---|---|---|---|---|');
    for (const f of t.fields) {
      const vals = f.enum ? f.enum.map(v => '`' + v + '`').join(' ') : (f.desc || '');
      const ref = f.ref ? `[\`${f.ref}\`](${anchor(f.ref)})` : '—';
      w(`| \`${f.name}\` | \`${f.type}\`${f.required ? ' **req**' : ''} | ${f.label} | ${ref} | ${vals} |`);
    }
    const deps = dependents(t.id);
    if (deps.length) {
      w();
      w(`_Referenced by:_ ${deps.map(d => '`' + d.from + '.' + d.via + '`').join(', ')}`);
    }
    w();
  }
  w('---');
  w();
}

w('## Every foreign key');
w();
w('| From | Field | To | Meaning |');
w('|---|---|---|---|');
for (const e of edges) w(`| \`${e.from}\` | \`${e.via}\` | \`${e.to}\` | ${e.label} |`);
w();

process.stdout.write(out.join('\n') + '\n');
