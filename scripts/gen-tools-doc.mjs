// Regenerates docs/TOOLS.md and docs/TOOLS.md.csv from the source of truth:
// each tool's `<id>.meta.ts`. No build step required.
//
// Usage: node scripts/gen-tools-doc.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith('.meta.ts')) out.push(path);
  }
  return out;
}

const value = (src, key) => new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(src)?.[1];

const tools = [];
for (const path of walk(join(root, 'src', 'tools'))) {
  const id = basename(path).replace(/\.meta\.ts$/, '');
  const src = readFileSync(path, 'utf8');
  const input = /input:\s*'(text|file)'/.exec(src)?.[1];
  tools.push({
    id,
    name: value(src, 'name') ?? id,
    category: value(src, 'category') ?? 'misc',
    input: input ?? 'text',
    status: /status:\s*'(stable|beta)'/.exec(src)?.[1] ?? 'stable',
    summary: value(src, 'summary') ?? '',
  });
}

const categories = [...new Set(tools.map((t) => t.category))].sort();
const byName = (a, b) => a.name.localeCompare(b.name);

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csvRows = ['id,name,category,input,status,summary'];
const md = [
  '# Complete Tool List',
  '',
  `Total: **${tools.length}** tools across **${categories.length}** categories.`,
  '',
  'Generated from `src/tools/**/*.meta.ts` (source of truth).',
  '',
];

for (const category of categories) {
  const items = tools.filter((t) => t.category === category).sort(byName);
  md.push(`## ${category} (${items.length})`, '');
  md.push('| id | name | input | status | summary |');
  md.push('| --- | --- | --- | --- | --- |');
  for (const t of items) {
    md.push(`| \`${t.id}\` | ${t.name} | ${t.input} | ${t.status} | ${t.summary} |`);
    csvRows.push([t.id, t.name, t.category, t.input, t.status, t.summary].map(csvCell).join(','));
  }
  md.push('');
}

writeFileSync(join(root, 'docs', 'TOOLS.md'), `${md.join('\n').trimEnd()}\n`);
writeFileSync(join(root, 'docs', 'TOOLS.md.csv'), `${csvRows.join('\n')}\n`);
console.log(`Wrote docs/TOOLS.md and docs/TOOLS.md.csv (${tools.length} tools).`);
