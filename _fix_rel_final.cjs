const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// 最终权威映射(基于代码实测): schema字段名 -> 代码关系键
// 仅改「字段名」, 保留类型/模型名(类型用 \(type\) 捕获)
const MAP = [
  // 单词关系 -> 单数 camel
  { from: 'users',            to: 'user' },
  { from: 'outlets',          to: 'outlet' },
  { from: 'seals',            to: 'seal' },
  // 多词关系 -> 单词代码键
  { from: 'delivery_receipts',to: 'receipts' },
  { from: 'order_assignments',to: 'assignment' },
  { from: 'seal_packages',    to: 'package' },
  // question_replies 关系 -> replies (代码 include: { replies })
  { from: 'question',         to: 'replies', onlyModel: 'question_replies' },
];

const lines = schema.split('\n');
const rels = [];
let cur = null;
for (const l of lines) {
  const m = /^\s*model\s+(\w+)/.exec(l);
  if (m) { cur = m[1]; continue; }
  if (/^\s*}/.test(l)) { cur = null; continue; }
  const r = /^\s*(\w+)\s+(\w+[\[\]?]*)\s+.*@relation/.exec(l);
  if (r && cur) rels.push({ model: cur, field: r[1], type: r[2].replace(/[\[\]?]/g,''), related: r[2].replace(/[\[\]?]/g,'') });
}

const plan = [];
for (const rel of rels) {
  for (const m of MAP) {
    if (rel.field !== m.from) continue;
    if (m.onlyModel && rel.model !== m.onlyModel) continue;
    if (m.onlyRelated && rel.related !== m.onlyRelated) continue;
    plan.push({ model: rel.model, from: rel.field, to: m.to, related: rel.related });
    break;
  }
}

console.log('=== 最终关系字段改名计划 ===');
for (const p of plan) console.log(`  ${p.model}.${p.from} -> ${p.to}  (关联 ${p.related})`);
console.log('共 '+plan.length+' 个');

if (process.env.APPLY === '1') {
  let n = 0;
  for (const p of plan) {
    const re = new RegExp('^(\\s*)' + p.from + '(?=\\s)', 'gm');
    const before = schema;
    schema = schema.replace(re, '$1' + p.to);
    if (schema !== before) n++;
  }
  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log('APPLY done: 改写 '+n+' 个字段声明');
}
