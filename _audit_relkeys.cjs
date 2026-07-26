const fs = require('fs');
const path = require('path');

const root = 'src';
const files = [];
function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name.endsWith('.ts')) files.push(p); } }
walk(root);

const RELKEYS = ['include','select','where','connect','create','update','data','some','every','none','is','set','push'];
const OPERATORS = new Set(['gte','lte','lt','gt','in','notIn','contains','startsWith','endsWith','mode','AND','OR','NOT','skip','take','orderBy','equals','not','has','hasEvery','hasSome','isEmpty','string_contains','some','every','none','is','isNot','set','push','increment','decrement','undefined','true','false','null','id']);

function extractObj(src, start){
  // start points at '{'
  let depth=0, i=start;
  for(; i<src.length; i++){
    const c=src[i];
    if(c==='{') depth++;
    else if(c==='}'){ depth--; if(depth===0) return src.slice(start, i+1); }
  }
  return src.slice(start, i);
}

const allKeys = new Set();
for(const f of files){
  const src = fs.readFileSync(f,'utf8');
  for(const kw of RELKEYS){
    const re = new RegExp('\\b'+kw+'\\s*:','g');
    let m;
    while((m = re.exec(src))){
      // find next '{'
      const after = src.indexOf('{', m.index);
      if(after<0||after-m.index>40) continue;
      const obj = extractObj(src, after);
      // 提取顶层 key (word:)
      const kr = /([A-Za-z_]\w*)\s*:/g; let km;
      while((km=kr.exec(obj))){
        const key = km[1];
        if(!OPERATORS.has(key)) allKeys.add(key);
      }
    }
  }
}
// 过滤掉明显的标量字段常见名, 只保留可能是关系字段的(单数/自定义)
const scalars = new Set(['id','nickname','phone','name','status','status_text','type','company_name','contact_phone','legal_person','license_region','seal_reason','total_price','pay_price','created_at','updated_at','remark','pay_time','pay_method','transaction_id','express_company','express_no','admin_remark','processed_by','processed_at','assignment_status','delivery_status','signed_at','newspaper_content','newspaper_issue_count','invoice_json','newspaper_copy_count','newspaper_images','address_id','address_json','need_invoice','invoice_id','module','order_no','user_id','express','avatar','contact','service_area','url','title','content','category_name','price','count','region','province','city','district','images','preview','spec','material','seals','scene','userId','page','pageSize','keyword','startDate','endDate','date','time','amount','fee','refund','reason','reply','answer','score','tags','code','text','desc','note','level','sort','field','value','label','key','order','list','data','total','pagination','items','info','detail','result','success','message','err','error']);
const relCandidates = [...allKeys].filter(k=>!scalars.has(k)).sort();
console.log('=== 代码中出现的关系键候选 (非标量) ===');
console.log(relCandidates.join(', '));
console.log('\n=== 单独列出含下划线的(应为已修正的 snake) ===');
console.log(relCandidates.filter(k=>k.includes('_')).join(', '));
