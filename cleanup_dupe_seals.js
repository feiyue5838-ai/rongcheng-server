const http = require('http');
function api(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const b = body ? JSON.stringify(body) : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (b) headers['Content-Length'] = Buffer.byteLength(b);
        const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
        });
        req.on('error', reject);
        if (b) req.write(b);
        req.end();
    });
}
async function main() {
    const login = await api('POST', '/api/auth/admin/login', { username: 'admin', password: 'admin123' });
    const token = login.token;

    // 1. 获取所有印章（含 categoryId=null）
    const all = await api('GET', '/api/seals/admin', null, token);
    const orphans = all.filter(s => !s.categoryId);
    console.log('categoryId=null 记录:', orphans.length);

    // 2. 获取已绑定到刻章备案查询的省份名称
    const cats = await api('GET', '/api/seals/categories', null, token);
    const queryCat = cats.find(c => c.name === '刻章备案查询');
    const queryDetail = await api('GET', '/api/seals/categories/' + queryCat.id, null, token);
    const queryNames = new Set(queryDetail.seals.map(s => s.name));

    // 3. 找出要删除的：categoryId=null，且名称不在省份列表中（即真正的脏数据）
    const toDelete = orphans.filter(s => !queryNames.has(s.name));
    console.log('待删除（省份以外）:', toDelete.length);
    toDelete.forEach(s => console.log('  删除: ' + s.name + ' [id=' + s.id + ']'));

    // 4. 删除
    for (const s of toDelete) {
        try {
            await api('DELETE', '/api/seals/' + s.id, null, token);
            console.log('✅ 已删除: ' + s.name);
        } catch (e) {
            console.log('❌ 删除失败: ' + s.name + ' - ' + JSON.stringify(e));
        }
    }

    // 5. 验证剩余
    const remaining = await api('GET', '/api/seals/admin', null, token);
    const remOrphans = remaining.filter(s => !s.categoryId);
    console.log('\n验证 - categoryId=null 剩余:', remOrphans.length);
    remOrphans.forEach(s => console.log('  ' + s.name));
}
main().catch(console.error);
