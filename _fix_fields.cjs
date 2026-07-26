const fs = require('fs');
const path = require('path');

// 1. 提取 schema 所有字段名(仅 model 块内)
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const fieldSet = new Set();
const flines = schema.split('\n');
let inModel = false;
for (const line of flines) {
  if (/^\s*model\s+/.test(line)) { inModel = true; continue; }
  if (/^\s*}\s*$/.test(line) && inModel) { inModel = false; continue; }
  if (!inModel) continue;
  const m = /^\s+([a-z][a-z0-9_]*)\s+\S/.exec(line);
  if (m) fieldSet.add(m[1]);
}
console.log('schema 字段总数: ' + fieldSet.size);

// 2. 多词字段: camelCase -> snake_case
function camel(s) {
  return s.split('_').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
const map = {};
for (const f of fieldSet) {
  if (!f.includes('_')) continue;
  const c = camel(f);
  if (c !== f) map[c] = f;
}
console.log('camel->snake 候选数: ' + Object.keys(map).length);

// 3. 仅对源码中实际出现的 camel 字段做替换
const root = 'src';
const toFix = {};
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) {
      const s = fs.readFileSync(p, 'utf8');
      for (const c of Object.keys(map)) {
        if (new RegExp('\\b' + c + '\\b').test(s)) toFix[c] = map[c];
      }
    }
  }
}
walk(root);
console.log('源码中需修正的字段数: ' + Object.keys(toFix).length);
console.log('=== FIELD MAP (camel -> snake) ===');
for (const c of Object.keys(toFix).sort()) console.log('  ' + c + ' -> ' + toFix[c]);

if (process.env.APPLY === '1') {
  let total = 0, files = 0;
  function walk2(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk2(p);
      else if (e.name.endsWith('.ts')) {
        let s = fs.readFileSync(p, 'utf8'); let changed = false;
        for (const c of Object.keys(toFix)) {
          const re = new RegExp('\\b' + c + '\\b', 'g');
          if (re.test(s)) { s = s.replace(re, toFix[c]); changed = true; total++; }
        }
        if (changed) { fs.writeFileSync(p, s, 'utf8'); files++; }
      }
    }
  }
  walk2(root);
  console.log('APPLY done: ' + total + ' replacements in ' + files + ' files');
}
