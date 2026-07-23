const http = require('http');
const body = JSON.stringify({username:'admin',password:'admin123'});
const recv = (r) => { let d=''; r.on('data',c=>d+=c); return new Promise(res=>r.on('end',()=>res(d))); };
const req = (m,p,h) => new Promise(res=>{const r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:h||{}},async resp=>{const d=await recv(resp);res({status:resp.statusCode,data:d})});if(h?.['Content-Type'])r.write(body);r.end()});

(async()=>{
  const a = await req('POST','/api/auth/admin/login',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)});
  const o = JSON.parse(a.data);
  console.log('login:', o.message||'OK');
  const t = o.token;
  
  const dash = await req('GET','/api/dashboard',{'Authorization':'Bearer '+t});
  console.log('dashboard /api/dashboard:', dash.status, dash.data.substring(0,150));
  
  const dashTrend = await req('GET','/api/dashboard/trend?type=order&days=7',{'Authorization':'Bearer '+t});
  console.log('trend /api/dashboard/trend:', dashTrend.status, dashTrend.data.substring(0,150));

  const cats = await req('GET','/api/newspapers/categories',{'Authorization':'Bearer '+t});
  const catsJson = JSON.parse(cats.data);
  console.log('categories count:', catsJson.length);
  if(catsJson.length>0) console.log('first:', catsJson[0].name);
  
  const temps = await req('GET','/api/newspapers/templates?pageSize=5',{'Authorization':'Bearer '+t});
  const tempsJson = JSON.parse(temps.data);
  console.log('templates total:', tempsJson.pagination?.total||'?', 'status:', temps.status);
})();
