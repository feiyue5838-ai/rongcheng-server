const fs = require('fs');
const path = require('path');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. 解析所有 @relation 字段: (model, field, relatedModel)
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

// 2. 候选 code key 生成
function camel(s){ return s.split('_').map((w,i)=> i? w.charAt(0).toUpperCase()+w.slice(1) : w).join(''); }
function singular(s){
  if(/ies$/.test(s)) return s.slice(0,-3)+'y';
  if(/ses$/.test(s)) return s.slice(0,-2);
  if(/s$/.test(s) && !/ss$/.test(s)) return s.slice(0,-1);
  return s;
}
function candidates(R){
  const set = new Set();
  set.add(camel(R));
  set.add(singular(R.split('_').pop()));      // last-word singular
  if(!R.includes('_')) set.add(singular(R));   // 单词模型也试单数
  return [...set].filter(Boolean);
}

// 3. 扫描 src, 找出每个关系字段代码实际用的 key (\b<K>:)
const root = 'src';
let srcAll = '';
function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name.endsWith('.ts')) srcAll += fs.readFileSync(p,'utf8')+'\n'; } }
walk(root);

const renames = [];
for (const rel of rels) {
  const cands = candidates(rel.related);
  let found = null;
  // 优先非模型名候选
  const ordered = cands.sort((a,b)=> (a===rel.related?1:0)-(b===rel.related?1:0));
  for (const c of ordered) {
    if (new RegExp('\\b'+c+':').test(srcAll)) { found = c; break; }
  }
  if (found && found !== rel.field) {
    renames.push({ model: rel.model, from: rel.field, to: found, related: rel.related, cands });
  }
}

console.log('=== 关系字段重命名计划 (schema -> 代码 key) ===');
for (const r of renames) console.log(`  ${r.model}.${r.from} -> ${r.to}   (关联 ${r.related}, 候选 ${r.cands.join('/')})`);
console.log('共 '+renames.length+' 个');

if (process.env.APPLY === '1') {
  let n = 0;
  for (const r of renames) {
    // 仅替换该行首字段名(保留类型/模型名)
    const re = new RegExp('^(\\s*)'+r.from+'((?=\\s))', 'gm');
    const before = schema;
    schema = schema.replace(re, '$1'+r.to);
    if (schema !== before) n++;
  }
  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log('APPLY done: 改写 '+n+' 个字段声明');
}
