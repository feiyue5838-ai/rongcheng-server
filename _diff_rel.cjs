const fs = require('fs');
const path = require('path');

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
// schema 关系字段: model -> { field: relatedModel }
const lines = schema.split('\n');
const schemaRel = {};
let cur = null;
for (const l of lines) {
  const m = /^\s*model\s+(\w+)/.exec(l);
  if (m) { cur = m[1]; schemaRel[cur] = schemaRel[cur] || {}; continue; }
  if (/^\s*}/.test(l)) { cur = null; continue; }
  const r = /^\s*(\w+)\s+(\w+[\[\]?]*)\s+.*@relation/.exec(l);
  if (r && cur) schemaRel[cur][r[1]] = r[2].replace(/[\[\]?]/g, '');
}

// 代码关系键抽取
const root = 'src';
const files = [];
(function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name.endsWith('.ts')) files.push(p); } })(root);
const srcAll = files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const OP = new Set(['gte','lte','lt','gt','in','notIn','contains','startsWith','endsWith','mode','AND','OR','NOT','skip','take','orderBy','equals','not','has','hasEvery','hasSome','isEmpty','string_contains','isNot','set','push','increment','decrement','asc','desc','true','false','null','undefined','select','include','where','data','connect','create','update','_count','some','every','none','is','_sum','_avg','_min','_max','_count']);
function extractObj(src, start){ let d=0,i=start; for(;i<src.length;i++){const c=src[i]; if(c==='{')d++; else if(c==='}'){d--; if(d===0)return src.slice(start,i+1);}} return src.slice(start,i); }
const codeKeys = new Set();
for (const kw of ['include','select','_count','connect','create','update','data','where','some','every','none','is']) {
  const re = new RegExp('\\b'+kw+'\\s*:','g'); let m;
  while((m=re.exec(srcAll))){ const after=srcAll.indexOf('{',m.index); if(after<0||after-m.index>60)continue; const obj=extractObj(srcAll,after); const kr=/([A-Za-z_]\w*)\s*:/g; let km; while((km=kr.exec(obj))){ const k=km[1]; if(!OP.has(k)) codeKeys.add(k); } }
}
// 也收集 this.prisma.<MODEL>.find/... 的 MODEL
const modelsUsed = new Set();
for (const mm of srcAll.matchAll(/this\.prisma\.(\w+)\./g)) modelsUsed.add(mm[1]);

console.log('=== 关系字段差异 (schema 字段名 vs 代码键) ===');
let mismatch = 0;
for (const model of Object.keys(schemaRel)) {
  if (!modelsUsed.has(model)) continue;
  for (const [field, related] of Object.entries(schemaRel[model])) {
    if (codeKeys.has(field)) continue;             // 一致
    // schema 字段名不在代码键里 -> 可能代码用别的键
    const snake = field.includes('_');
    const alt = snake
      ? field.split('_').map((w,i)=> i? w[0].toUpperCase()+w.slice(1):w).join('')
      : (field.endsWith('s') ? field.slice(0,-1) : field);
    const alt2 = snake ? field.split('_').pop() : field;
    const codeUse = codeKeys.has(alt) ? alt : (codeKeys.has(alt2) ? alt2 : null);
    console.log(`  ${model}.${field} (关联 ${related}) -- 代码键不在其中; 候选: ${alt}/${(field.endsWith('s')&&!snake)?field.slice(0,-1):''}/${alt2} => ${codeUse?'代码用 '+codeUse:'??'}`);
    mismatch++;
  }
}
console.log('共 '+mismatch+' 个潜在不一致');
console.log('\n=== 代码里出现、但不在任何 schema 关系字段名中的键(用于反查) ===');
const allSchemaFields = new Set(Object.values(schemaRel).flatMap(o=>Object.keys(o)));
for (const k of [...codeKeys].sort()) if (!allSchemaFields.has(k)) console.log('  '+k);
