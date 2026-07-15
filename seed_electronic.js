const { PrismaClient } = require('.prisma/client');
const p = new PrismaClient();

const API = 'http://localhost:7890/api';

async function apiCreate(path, data, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

// 兼容 {data:{id}} 和直接返回 {id} 两种格式
function extractSeal(result) {
  if (result && result.id) return result;
  if (result && result.data && result.data.id) return result.data;
  return null;
}

// 先登录获取 admin token
async function getAdminToken() {
  const res = await fetch(`${API}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const data = await res.json();
  return data.token || data.data?.access_token;
}

async function main() {
  console.log('[1] 登录获取 token...');
  const token = await getAdminToken();
  if (!token) throw new Error('登录失败');
  console.log('  token OK');

  // 2. 查场景 ID
  const scenes = await p.sealScene.findMany({ select: { id: true, name: true } });
  const sceneMap = {};
  scenes.forEach(s => sceneMap[s.name] = s.id);
  console.log('[2] 场景:', Object.keys(sceneMap).join(', '));

  // 3. 查现有印章（避免重复）
  const existing = await p.seal.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map(s => s.name));
  console.log(`[3] 已有印章 ${existingNames.size} 个`);

  // 4. 电子印章产品列表
  const electronicSeals = [
    // 公章系
    { name: '电子公章(一年有效期)', type: '电子公章', validity: 1, price: 150, desc: '电子公章，一年有效期，不限签署次数', icon: '' },
    { name: '电子公章(两年有效期)', type: '电子公章', validity: 2, price: 280, desc: '电子公章，两年有效期，不限签署次数', icon: '' },
    { name: '电子公章(三年有效期)', type: '电子公章', validity: 3, price: 380, desc: '电子公章，三年有效期，不限签署次数', icon: '' },
    // 财务章系
    { name: '电子财务章(一年有效期)', type: '电子财务章', validity: 1, price: 120, desc: '电子财务章，一年有效期，不限签署次数', icon: '' },
    { name: '电子财务章(两年有效期)', type: '电子财务章', validity: 2, price: 220, desc: '电子财务章，两年有效期，不限签署次数', icon: '' },
    { name: '电子财务章(三年有效期)', type: '电子财务章', validity: 3, price: 300, desc: '电子财务章，三年有效期，不限签署次数', icon: '' },
    // 合同章系
    { name: '电子合同章(一年有效期)', type: '电子合同章', validity: 1, price: 120, desc: '电子合同章，一年有效期，不限签署次数', icon: '' },
    { name: '电子合同章(两年有效期)', type: '电子合同章', validity: 2, price: 220, desc: '电子合同章，两年有效期，不限签署次数', icon: '' },
    { name: '电子合同章(三年有效期)', type: '电子合同章', validity: 3, price: 300, desc: '电子合同章，三年有效期，不限签署次数', icon: '' },
    // 法人章系
    { name: '电子法人章(一年有效期)', type: '电子法人章', validity: 1, price: 100, desc: '电子法人章，一年有效期，不限签署次数', icon: '' },
    { name: '电子法人章(两年有效期)', type: '电子法人章', validity: 2, price: 180, desc: '电子法人章，两年有效期，不限签署次数', icon: '' },
    { name: '电子法人章(三年有效期)', type: '电子法人章', validity: 3, price: 250, desc: '电子法人章，三年有效期，不限签署次数', icon: '' },
    // 发票章系
    { name: '电子发票章(一年有效期)', type: '电子发票章', validity: 1, price: 100, desc: '电子发票章，一年有效期，不限签署次数', icon: '' },
    { name: '电子发票章(两年有效期)', type: '电子发票章', validity: 2, price: 180, desc: '电子发票章，两年有效期，不限签署次数', icon: '' },
    { name: '电子发票章(三年有效期)', type: '电子发票章', validity: 3, price: 250, desc: '电子发票章，三年有效期，不限签署次数', icon: '' },
    // 个人签名章系
    { name: '电子个人签名章(一年有效期)', type: '电子个人签名章', validity: 1, price: 60, desc: '电子个人签名章，一年有效期，不限签署次数', icon: '' },
    { name: '电子个人签名章(两年有效期)', type: '电子个人签名章', validity: 2, price: 100, desc: '电子个人签名章，两年有效期，不限签署次数', icon: '' },
    { name: '电子个人签名章(三年有效期)', type: '电子个人签名章', validity: 3, price: 140, desc: '电子个人签名章，三年有效期，不限签署次数', icon: '' },
  ];

  // 5. 刻章备案查询服务
  const recordSearch = [
    { name: '刻章备案查询(单次)', price: 30, desc: '输入企业名称或统一社会信用代码，查询章铭网印章备案信息，单次查询' },
    { name: '刻章备案查询(包月)', price: 80, desc: '章铭网印章备案查询，包月不限次数' },
    { name: '刻章备案查询(包年)', price: 200, desc: '章铭网印章备案查询，包年不限次数' },
  ];

  // 6. 创建电子印章（绑定场景 + 建立关联）
  console.log('\n[4] 创建电子印章产品...');
  let elCreated = 0, elSkipped = 0;
  for (const s of electronicSeals) {
    if (existingNames.has(s.name)) {
      console.log(`  跳过(已存在): ${s.name}`);
      elSkipped++;
      continue;
    }
    const result = await apiCreate('/seals', {
      name: s.name,
      price: s.price,
      description: s.desc,
      categoryId: null, // 可空
      sort: 0,
      status: 1,
    }, token);
    // 绑定到"电子印章"场景
    const newSeal = extractSeal(result);
    if (newSeal) {
      await p.sealSceneSeal.create({
        data: { sceneId: sceneMap['电子印章'], sealId: newSeal.id, sort: 0 },
      });
      console.log(`  创建: ${s.name} (¥${s.price})`);
      elCreated++;
    } else {
      console.log(`  创建失败: ${s.name}`);
    }
  }
  console.log(`  电子印章: ${elCreated} 新建, ${elSkipped} 已存在`);

  // 7. 创建刻章备案查询（绑定场景）
  console.log('\n[5] 创建刻章备案查询产品...');
  let rsCreated = 0, rsSkipped = 0;
  for (const s of recordSearch) {
    if (existingNames.has(s.name)) {
      console.log(`  跳过(已存在): ${s.name}`);
      rsSkipped++;
      continue;
    }
    const result = await apiCreate('/seals', {
      name: s.name,
      price: s.price,
      description: s.desc,
      categoryId: null,
      sort: 0,
      status: 1,
    }, token);
    const newSeal2 = extractSeal(result);
    if (newSeal2) {
      await p.sealSceneSeal.create({
        data: { sceneId: sceneMap['刻章备案查询'], sealId: newSeal2.id, sort: 0 },
      });
      console.log(`  创建: ${s.name} (¥${s.price})`);
      rsCreated++;
    }
  }
  console.log(`  刻章备案查询: ${rsCreated} 新建, ${rsSkipped} 已存在`);

  // 8. 验证
  console.log('\n=== 验证 ===');
  const verifyScenes = await p.sealScene.findMany({
    include: { _count: { select: { sealSceneSeals: true, sealScenePackages: true } } },
  });
  for (const s of verifyScenes) {
    const seals = await p.sealSceneSeal.findMany({
      where: { sceneId: s.id },
      include: { seal: { select: { name: true, price: true } } },
    });
    console.log(`  ${s.name}: ${s._count.sealSceneSeals} 个印章`);
    seals.slice(0, 3).forEach(ss => console.log(`    - ${ss.seal.name} ¥${ss.seal.price}`));
    if (seals.length > 3) console.log(`    ... 还有 ${seals.length - 3} 个`);
  }

  await p.$disconnect();
  console.log('\n完成!');
}

main().catch(async e => {
  console.error('ERROR:', e.message);
  await p.$disconnect();
  process.exit(1);
});
