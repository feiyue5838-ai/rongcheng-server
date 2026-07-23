const http = require('http');
const body = JSON.stringify({username:'admin',password:'admin123'});
const recv = r => { let d=''; r.on('data',c=>d+=c); return new Promise(res=>r.on('end',()=>res(d))); };
const req = (m,p,h) => new Promise(res=>{const r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:h||{}},async resp=>{const d=await recv(resp);res({status:resp.statusCode,data:d.substring(0,500)})});if(h?.['Content-Type'])r.write(body);r.end()});

(async()=>{
  const a=await req('POST','/api/auth/admin/login',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)});
  const t=JSON.parse(a.data).token;
  const r=await req('GET','/api/newspapers/templates?pageSize=2',{'Authorization':'Bearer '+t});
  console.log(r.status);
  console.log(r.data);
})();
