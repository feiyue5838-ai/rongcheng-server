const http = require('http');

function api(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const b = body ? JSON.stringify(body) : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (b) headers['Content-Length'] = Buffer.byteLength(b);
        const opts = { hostname: 'localhost', port: 3001, path, method, headers };
        const req = http.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve(JSON.parse(d)); }
                catch { resolve(d); }
            });
        });
        req.on('error', reject);
        if (b) req.write(b);
        req.end();
    });
}

async function main() {
    // 1. 登录
    const login = await api('POST', '/api/auth/admin/login', { username: 'admin', password: 'admin123' });
    const token = login.token || (login.data && login.data.token);
    if (!token) { console.log('登录失败:', login); return; }
    console.log('登录成功，token:', token.slice(0, 20) + '...');

    // 2. 获取所有省份
    const list = await api('GET', '/api/seals/admin/record-queries', null, token);
    console.log(`共 ${list.length} 条`);

    // 3. 抽查四川当前状态
    const sc = list.find(r => r.name === '四川省');
    if (sc) {
        console.log('\n当前四川数据:');
        console.log('  bytes:', Buffer.from(sc.description || '').toString('hex'));
        console.log('  raw:', sc.description);
    }

    // 4. 用 Node.js 发送带中文的更新请求
    const testDesc = '四川省印章查询\nhttps://www.hbyzcx.com/Mobile/';
    console.log('\n发送内容:', JSON.stringify(testDesc));
    console.log('字节:', Buffer.from(testDesc).toString('hex'));

    const update = await api('PUT', `/api/seals/admin/record-queries/${sc.id}`, { description: testDesc }, token);
    console.log('更新响应:', JSON.stringify(update).slice(0, 100));

    // 5. 重新查询验证
    const list2 = await api('GET', '/api/seals/admin/record-queries', null, token);
    const sc2 = list2.find(r => r.name === '四川省');
    console.log('\n验证四川:');
    console.log('  bytes:', Buffer.from(sc2.description || '').toString('hex'));
    console.log('  raw:', sc2.description);

    // 6. 确认OK后批量更新所有
    const allOk = sc2.description.includes('四川省印章查询');
    if (allOk) {
        console.log('\n✅ 编码正确，开始批量更新...');
        for (const r of list) {
            const desc = `全国印章查询平台 (hbyzcx.com)\nhttps://www.hbyzcx.com/Mobile/`;
            await api('PUT', `/api/seals/admin/record-queries/${r.id}`, { description: desc }, token);
            console.log(`✅ ${String(r.sort).padStart(2,'0')} ${r.name}`);
        }
        console.log(`\n全部完成 ${list.length} 条`);
    } else {
        console.log('\n❌ 编码仍然错误，需要检查 NestJS 配置');
    }
}

main().catch(console.error);
