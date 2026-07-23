const http = require('http');
const body = JSON.stringify({username:'admin',password:'admin123'});
const recv = r => { let d=''; r.on('data',c=>d+=c); return new Promise(res=>r.on('end',()=>res(d))); };
const req = (m,p,h) => new Promise(res=>{const r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:h||{}},async resp=>{const d=await recv(resp);res({status:resp.statusCode,data:d})});if(h?.['Content-Type'])r.write(body);r.end()});

(async()=>{
  const a=await req('POST','/api/auth/admin/login',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)});
  const t=JSON.parse(a.data).token;
  
  // templates - may return array directly
  const r=await req('GET','/api/newspapers/templates?pageSize=1',{'Authorization':'Bearer '+t});
  const d=JSON.parse(r.data);
  console.log('模板: array='+Array.isArray(d)+', len='+(d.length||'?'+(d.list?.length||'?')));
  console.log('sample status=', r.status);
  
  // outlets
  const or=await req('GET','/api/outlets?pageSize=3',{'Authorization':'Bearer '+t});
  const od=JSON.parse(or.data);
  console.log('网点: list='+(od.list?.length||'?'), 'total='+(od.pagination?.total||'?'));
  
  // newspaper categories
  const nc=await req('GET','/api/newspapers/categories',{'Authorization':'Bearer '+t});
  const nd=JSON.parse(nc.data);
  console.log('公告分类:', nd.length, nd.map(x=>x.name).join(','));
  
  // newspaper papers (newspapers)
  const np=await req('GET','/api/newspapers/papers?pageSize=5',{'Authorization':'Bearer '+t});
  const npp=JSON.parse(np.data);
  console.log('报纸:', typeof npp, npp.list?.length||npp.length||'?');
})();
