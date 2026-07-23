const http = require('http');
const body = JSON.stringify({username:'admin',password:'admin123'});
const recv = r => { let d=''; r.on('data',c=>d+=c); return new Promise(res=>r.on('end',()=>res(d))); };
const req = (m,p,h) => new Promise(res=>{const r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:h||{}},async resp=>{const d=await recv(resp);res({status:resp.statusCode,data:JSON.parse(d)})});if(h?.['Content-Type'])r.write(body);r.end()});

(async()=>{
  const a=await req('POST','/api/auth/admin/login',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)});
  const t=a.data.token;
  
  const r=await req('GET','/api/newspapers/templates?pageSize=5',{'Authorization':'Bearer '+t});
  const dd = r.data;
  console.log('templates:', JSON.stringify({total:dd.pagination?.total,totalPages:dd.pagination?.totalPages,first:dd.list?.[0]?.name,first2:dd.list?.[1]?.name}));
  
  const orders=await req('GET','/api/orders/admin/list?pageSize=5',{'Authorization':'Bearer '+t});
  const od = orders.data;
  console.log('orders total:', od.pagination?.total, 'firstId:', od.list?.[0]?.id?.substring(0,20));
})();
