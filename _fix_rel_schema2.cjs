const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// relatedModel -> 代码实际用的 camelCase 关系键 (已核对 schema 关系字段 + 代码用法)
const MAP = {
  users: 'user',
  outlets: 'outlet',
  questions: 'question',
  newspapers: 'newspaper',
  seals: 'seal',
  delivery_receipts: 'receipts',
  order_assignments: 'assignment',
  seal_packages: 'package',
};

const lines = schema.split('\n');
const rels = [];
let cur = null;
for (const l of lines) {
  const m = /^\s*model\s+(\w+)/.exec(l);
  if (m) { cur = m[1]; continue; }
  if (/^\s*}/.test(l)) { cur = null; continue; }
  const r = /^\s*(\w+)\s+(\w+[\[\]?]*)\s+.*@relation/.exec(l);
  if (r && cur) rels.push({ model: cur, field: r[1], related: r[2].replace(/[\[\]?]/g, '') });
}

const renames = [];
for (const rel of rels) {
  const to = MAP[rel.related];
  if (to && to !== rel.field) renames.push({ model: rel.model, from: rel.field, to, related: rel.related });
}

console.log('=== 关系字段改名(字段名->代码key, 保留类型/模型名) ===');
for (const r of renames) console.log(`  ${r.model}.${r.from} -> ${r.to}  (关联 ${r.related})`);
console.log('共 ' + renames.length + ' 个');

if (process.env.APPLY === '1') {
  let n = 0;
  for (const r of renames) {
    const re = new RegExp('^(\\s*)' + r.from + '(?=\\s)', 'gm');
    const before = schema;
    schema = schema.replace(re, '$1' + r.to);
    if (schema !== before) n++;
  }
  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log('APPLY done: 改写 ' + n + ' 个字段声明');
}
