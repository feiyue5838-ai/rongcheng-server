const fs = require('fs');
const path = require('path');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. 解析所有 @relation 字段
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

// 2. 抽代码真实关系键: include/select/_count.select/connect/create/update/data/where 块顶层键
const root = 'src';
const files = [];
function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name.endsWith('.ts')) files.push(p); } }
walk(root);
let srcAll = files.map(f=>fs.readFileSync(f,'utf8')).join('\n');

const KEYWORDS = ['include','select','_count','connect','create','update','data','where','some','every','none','is','set','push','orderBy'];
const OP = new Set(['gte','lte','lt','gt','in','notIn','contains','startsWith','endsWith','mode','AND','OR','NOT','skip','take','orderBy','equals','not','has','hasEvery','hasSome','isEmpty','string_contains','isNot','set','push','increment','decrement','asc','desc','true','false','null','undefined']);
function extractObj(src, start){ let d=0,i=start; for(;i<src.length;i++){const c=src[i]; if(c==='{')d++; else if(c==='}'){d--; if(d===0)return src.slice(start,i+1);}} return src.slice(start,i); }
const codeKeys = new Set();
for (const kw of KEYWORDS) {
  const re = new RegExp('\\b'+kw+'\\s*:','g'); let m;
  while((m=re.exec(srcAll))){
    const after = srcAll.indexOf('{', m.index);
    if(after<0 || after-m.index>60) continue;
    const obj = extractObj(srcAll, after);
    const kr = /([A-Za-z_]\w*)\s*:/g; let km;
    while((km=kr.exec(obj))){ const k=km[1]; if(!OP.has(k)) codeKeys.add(k); }
  }
}

// 3. 对每个关系字段, 由 relatedModel 派生候选键, 选代码里实际出现的那个
function camel(s){ return s.split('_').map((w,i)=> i? w.charAt(0).toUpperCase()+w.slice(1):w).join(''); }
function singular(s){ if(/ies$/.test(s)) return s.slice(0,-3)+'y'; if(/ses$/.test(s)) return s.slice(0,-2); if(/s$/.test(s)&&!/ss$/.test(s)) return s.slice(0,-1); return s; }
function lastWord(s){ return s.split('_').pop(); }
function candidates(R, isArray){
  if(isArray) return [R];                      // 反向数组: 代码用 snake 复数
  const set = new Set();
  set.add(camel(R));
  set.add(singular(lastWord(R)));              // 取最后词单数 (receipts/delivery_receipts->receipts)
  if(!R.includes('_')) set.add(singular(R));   // 单词模型取单数
  return [...set];
}

const renames = [];
for (const rel of rels) {
  const isArray = rel.field.endsWith('[]');
  const cands = candidates(rel.related, isArray).filter(Boolean);
  let found = null;
  for (const c of cands) { if (codeKeys.has(c)) { found = c; break; } }
  if (!found) continue;                        // 代码未显式用该关系(保持)
  if (found !== rel.field) renames.push({ model: rel.model, from: rel.field, to: found, related: rel.related, isArray });
}

console.log('=== 关系字段最终改名(代码权威) ===');
for (const r of renames) console.log(`  ${r.model}.${r.from} -> ${r.to}  (关联 ${r.related}${r.isArray?' [数组]':''})`);
console.log('共 '+renames.length+' 个');

if (process.env.APPLY === '1') {
  let n = 0;
  for (const r of renames) {
    const re = new RegExp('^(\\s*)' + r.from + '(?=\\s)', 'gm');
    const before = schema;
    schema = schema.replace(re, '$1' + r.to);
    if (schema !== before) n++;
  }
  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log('APPLY done: 改写 '+n+' 个字段声明');
}
