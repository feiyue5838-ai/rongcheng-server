const http = require('http');

function req(path, method, extraHeaders, postData) {
  return new Promise((resolve) => {
    const headers = { ...extraHeaders };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    const opts = { hostname: 'localhost', port: 3001, path, method, headers };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', e => resolve({ error: e.message }));
    if (postData) r.write(postData);
    r.end();
  });
}

async function main() {
  const login = await req('/api/auth/admin/login', 'POST',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ username: 'admin', password: 'admin123' })
  );
  console.log('【登录】', login.status, login.body.slice(0, 200));
  const parsed = JSON.parse(login.body);
  const token = parsed?.token;
  if (!token) { console.log('无 token'); return; }

  const auth = { Authorization: `Bearer ${token}` };

  // 售后订单
  const orders = await req('/api/after-sales/orders', 'GET', auth);
  console.log('\n【售后订单】', orders.status, orders.body.slice(0, 300));

  // 退款记录
  const records = await req('/api/after-sales/refund-records', 'GET', auth);
  console.log('\n【退款记录】', records.status, records.body.slice(0, 300));
}

main().catch(console.error);
