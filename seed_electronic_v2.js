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

// 电子印章产品清单（5种章型 × 3个年限 = 15个）
const ELECTRONIC_SEALS = [
    // 公章
    { name: '电子公章(一年有效期)', price: 150 },
    { name: '电子公章(两年有效期)', price: 280 },
    { name: '电子公章(三年有效期)', price: 380 },
    // 财务章
    { name: '电子财务章(一年有效期)', price: 120 },
    { name: '电子财务章(两年有效期)', price: 220 },
    { name: '电子财务章(三年有效期)', price: 300 },
    // 合同章
    { name: '电子合同章(一年有效期)', price: 120 },
    { name: '电子合同章(两年有效期)', price: 220 },
    { name: '电子合同章(三年有效期)', price: 300 },
    // 法人章
    { name: '电子法人章(一年有效期)', price: 100 },
    { name: '电子法人章(两年有效期)', price: 180 },
    { name: '电子法人章(三年有效期)', price: 250 },
    // 发票章
    { name: '电子发票章(一年有效期)', price: 100 },
    { name: '电子发票章(两年有效期)', price: 180 },
    { name: '电子发票章(三年有效期)', price: 250 },
    // 个人签名章
    { name: '电子个人签名章(一年有效期)', price: 60 },
    { name: '电子个人签名章(两年有效期)', price: 100 },
    { name: '电子个人签名章(三年有效期)', price: 140 },
];

async function main() {
    const login = await api('POST', '/api/auth/admin/login', { username: 'admin', password: 'admin123' });
    const token = login.token;

    // 获取电子印章场景 ID
    const cats = await api('GET', '/api/seals/categories', null, token);
    const elecCat = cats.find(c => c.name === '电子印章');
    console.log('电子印章场景 ID:', elecCat.id);
    console.log('开始录入', ELECTRONIC_SEALS.length, '个电子印章...');

    let success = 0;
    for (const seal of ELECTRONIC_SEALS) {
        // 创建印章并绑定到电子印章场景
        const created = await api('POST', '/api/seals', {
            name: seal.name,
            description: seal.name,
            price: seal.price,
            status: 1,
            sort: 0,
            categoryId: elecCat.id, // 绑定到电子印章场景（adminCreateSeal 会同步创建 SealSceneSeal）
        }, token);
        console.log('✅ 创建: ' + seal.name + ' [id=' + created.id + ']');
        success++;
    }
    console.log('\n录入完成:', success, '/', ELECTRONIC_SEALS.length);

    // 验证
    const detail = await api('GET', '/api/seals/categories/' + elecCat.id, null, token);
    console.log('电子印章场景现有印章:', detail.seals.length);
}
main().catch(console.error);
