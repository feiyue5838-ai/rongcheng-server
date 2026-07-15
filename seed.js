const http = require('http');

function api(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const url = new URL('http://localhost:3000' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
      }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve(d); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data, 'utf8');
    req.end();
  });
}

async function main() {
  const login = await api('/api/auth/admin/login', 'POST', { username: 'admin', password: 'admin123' });
  const token = login.access_token;
  console.log('✓ 登录成功');

  // === 清理旧乱码数据 ===
  // 印章分类返回 { value: [], Count: 0 }
  const sealCats = await api('/seals/categories', 'GET', null, token);
  for (const c of (sealCats.value || [])) {
    await api('/seals/categories/' + c.id, 'DELETE', null, token);
  }
  console.log('✓ 清理旧印章分类');
  // 报纸分类返回数组
  const newsCats = await api('/newspapers/categories', 'GET', null, token);
  for (const c of (newsCats.value || newsCats || [])) {
    await api('/newspapers/categories/' + c.id, 'DELETE', null, token);
  }
  console.log('✓ 清理旧报纸分类');

  // === 创建印章分类 ===
  const sealCats = [
    { name: '企业公章', icon: 'business', sort: 1 },
    { name: '个人印章', icon: 'personal', sort: 2 },
    { name: '财务专用章', icon: 'finance', sort: 3 },
    { name: '法人章', icon: 'legal', sort: 4 },
    { name: '电子印章', icon: 'electronic', sort: 5 },
  ];
  for (const cat of sealCats) {
    const r = await api('/seals/categories', 'POST', cat, token);
    console.log('✓ 印章分类: ' + r.name);
  }

  // === 创建报纸分类 ===
  const newspaperCats = [
    { name: '注销公告', icon: 'cancel', sort: 1 },
    { name: '道歉声明', icon: 'apology', sort: 2 },
    { name: '法院公告', icon: 'court', sort: 3 },
    { name: '拍卖公告', icon: 'auction', sort: 4 },
    { name: '证件挂失', icon: 'lost', sort: 5 },
    { name: '债权公告', icon: 'creditor', sort: 6 },
    { name: '吸收合并公告', icon: 'merger', sort: 7 },
  ];
  for (const cat of newspaperCats) {
    const r = await api('/newspapers/categories', 'POST', cat, token);
    console.log('✓ 报纸分类: ' + r.name);
  }

  // === 验证最终数据 ===
  console.log('\n=== 最终数据 ===');
  const finalSeals = await api('/seals/categories', 'GET', null, token);
  const finalNews = await api('/newspapers/categories', 'GET', null, token);
  console.log('印章分类数量:', (finalSeals.value || finalSeals || []).length);
  console.log('报纸分类数量:', (finalNews.value || finalNews || []).length);
}

main().catch(console.error);
