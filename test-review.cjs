const http = require('http');
const body = JSON.stringify({username:'admin',password:'admin123'});
const loginReq = http.request({hostname:'localhost',port:3001,path:'/api/auth/admin/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const token = JSON.parse(data).token;

    // Test reviews list
    const r1 = http.request({hostname:'localhost',port:3001,path:'/api/reviews/admin/list?page=1&pageSize=20',headers:{'Authorization':'Bearer '+token}}, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => console.log('评价列表:', d));
    });
    r1.end();

    // Test questions list
    const r2 = http.request({hostname:'localhost',port:3001,path:'/api/questions/admin/list?page=1&pageSize=20',headers:{'Authorization':'Bearer '+token}}, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => console.log('问答列表:', d));
    });
    r2.end();
  });
});
loginReq.write(body);
loginReq.end();
