require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 先清除所有旧关联
  await p.sealSceneSeal.deleteMany({});
  console.log('✓ 清除所有场景印章关联');

  // 场景映射
  const sceneMap = {};
  const allScenes = await p.sealScene.findMany({ where: { sceneType: 'scene' } });
  for (const s of allScenes) sceneMap[s.name] = s;

  // 电子印章关键字
  const electronicNames = ['电子公章', '电子财务章', '电子合同章', '电子法人章', '电子发票章', '电子个人签名章'];
  // 省份名（末尾带"省/市/自治区/特别行政区"）
  const regionNames = ['省', '市', '自治区', '特别行政区'];

  const allSeals = await p.seal.findMany();
  const provinceSeals = allSeals.filter(s => regionNames.some(r => s.name.endsWith(r)));
  const electronicSeals = allSeals.filter(s => electronicNames.some(e => s.name.startsWith(e)));
  const steelSeals = allSeals.filter(s => s.name.includes('钢印章'));

  // 挂到"其他章名"
  for (const s of [...provinceSeals, ...electronicSeals]) {
    await p.sealSceneSeal.create({ data: { sceneId: sceneMap['其他章名'].id, sealId: s.id } });
  }
  console.log(`✓ 其他章名: 挂入省份印章(${provinceSeals.length}个) + 电子印章(${electronicSeals.length}个)`);

  // 钢印章场景
  for (const s of steelSeals) {
    await p.sealSceneSeal.create({ data: { sceneId: sceneMap['钢印章'].id, sealId: s.id } });
  }
  console.log(`✓ 钢印章: 挂入${steelSeals.map(s => s.name).join(', ')}`);

  // 场景ID映射（上面已定义）

  // 分类印章
  const cat1 = allSeals.filter(s => s.categoryId === 'c0000001-0000-0000-0000-000000000001'); // 企业印章
  const cat2 = allSeals.filter(s => s.categoryId === 'c0000001-0000-0000-0000-000000000002'); // 个人执业
  const cat3 = allSeals.filter(s => s.categoryId === 'c0000001-0000-0000-0000-000000000003'); // 发票/收据
  const cat4 = allSeals.filter(s => s.categoryId === 'c0000001-0000-0000-0000-000000000004'); // 法人章

  // 个体户：企业印章 + 个人执业 + 发票收据 + 法人章
  for (const s of [...cat1, ...cat2, ...cat3, ...cat4]) {
    await p.sealSceneSeal.create({ data: { sceneId: sceneMap['个体户'].id, sealId: s.id } });
  }
  console.log(`✓ 个体户: 企业印章(${cat1.length}) + 个人执业(${cat2.length}) + 发票收据(${cat3.length}) + 法人章(${cat4.length})`);

  // 公司：所有企业印章 + 发票收据 + 法人章
  for (const s of [...cat1, ...cat3, ...cat4]) {
    await p.sealSceneSeal.create({ data: { sceneId: sceneMap['公司'].id, sealId: s.id } });
  }
  console.log(`✓ 公司: 企业印章(${cat1.length}) + 发票收据(${cat3.length}) + 法人章(${cat4.length})`);

  // 新成立开户必备章：公章 + 财务专用章 + 法人章 + 合同专用章 + 发票专用章
  const mustHaves = allSeals.filter(s => ['公章','财务专用章','法人章','合同专用章','发票专用章'].includes(s.name));
  for (const s of mustHaves) {
    await p.sealSceneSeal.create({ data: { sceneId: sceneMap['新成立开户必备章'].id, sealId: s.id } });
  }
  console.log(`✓ 新成立开户必备章: ${mustHaves.map(s => s.name).join(', ')}`);

  // 单位名称变更必备章：公章 + 中英文对照公章 + 合同专用章
  const nameChangeSeals = allSeals.filter(s => ['公章','中英文对照公章','合同专用章'].includes(s.name));
  for (const s of nameChangeSeals) {
    await p.sealSceneSeal.create({ data: { sceneId: sceneMap['单位名称变更必备章'].id, sealId: s.id } });
  }
  console.log(`✓ 单位名称变更必备章: ${nameChangeSeals.map(s => s.name).join(', ')}`);

  // 单位法人变更必备章：公章 + 法人章
  const legalChangeSeals = allSeals.filter(s => ['公章','法人章'].includes(s.name));
  for (const s of legalChangeSeals) {
    await p.sealSceneSeal.create({ data: { sceneId: sceneMap['单位法人变更必备章'].id, sealId: s.id } });
  }
  console.log(`✓ 单位法人变更必备章: ${legalChangeSeals.map(s => s.name).join(', ')}`);

  // 政府事业单位：公章 + 合同专用章 + 财务专用章 + 法人章
  const govSeals = allSeals.filter(s => ['公章','合同专用章','财务专用章','法人章','发票专用章','收据专用章','中英文对照公章'].includes(s.name));
  for (const s of govSeals) {
    await p.sealSceneSeal.create({ data: { sceneId: sceneMap['政府事业单位'].id, sealId: s.id } });
  }
  console.log(`✓ 政府事业单位: ${govSeals.map(s => s.name).join(', ')}`);

  // 最终验证
  console.log('\n=== 最终场景配置 ===');
  const finalScenes = await p.sealScene.findMany({ where: { sceneType: 'scene' }, orderBy: { sort: 'asc' } });
  for (const s of finalScenes) {
    const count = await p.sealSceneSeal.count({ where: { sceneId: s.id } });
    console.log(`  [${s.sort}] ${s.name} (${count}个印章)`);
  }
}

main()
  .then(() => { console.log('\n完成!'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
