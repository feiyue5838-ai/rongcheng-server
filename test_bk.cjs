const http = require('http');

function post(path, data, token) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ hostname: 'localhost', port: 3001, path, method: 'POST', headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', e => resolve({ status: 0, data: e.message }));
    req.write(body); req.end();
  });
}

function get(path, token) {
  return new Promise((resolve) => {
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    const req = http.get({ hostname: 'localhost', port: 3001, path, headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', e => resolve({ status: 0, data: e.message }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ status: 0, data: 'timeout' }); });
  });
}

(async () => {
  console.log('=== 代理记账模块测试 ===\n');

  const loginRes = await post('/api/auth/admin/login', { username: 'admin', password: 'admin123' });
  const token = loginRes.data.token;
  console.log('✅ 登录成功\n');

  // 套餐列表
  const pkgRes = await get('/api/bookkeeping/packages', token);
  console.log(pkgRes.status === 200 ? '✅' : '❌', '代理记账套餐:', pkgRes.status === 200 ? (pkgRes.data.length || 0) + ' 条' : pkgRes.data);

  // 代理记账订单（专用接口）
  const ordersRes = await get('/api/bookkeeping/orders?pageSize=5', token);
  if (ordersRes.status === 200) {
    console.log('✅', '代理记账订单:', '总数 ' + ordersRes.data.total);
  } else {
    console.log('❌', '代理记账订单:', ordersRes.status, ordersRes.data);
  }

  // 订单列表过滤 bookkeeping
  const listRes = await get('/api/orders/admin/list?module=bookkeeping&pageSize=5', token);
  if (listRes.status === 200) {
    console.log('✅', '订单列表(代理记账):', '总数 ' + listRes.data.pagination.total);
  } else {
    console.log('❌', '订单列表(代理记账):', listRes.status, listRes.data);
  }

  console.log('\n=== 测试完成 ===');
})();
