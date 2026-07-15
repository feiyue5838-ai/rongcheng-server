const { PrismaClient } = require('.prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. 清空旧场景关联
  console.log('[1] 清空旧数据...');
  await p.sealSceneSeal.deleteMany();
  await p.sealScenePackage.deleteMany();
  await p.sealScene.deleteMany();
  console.log('  已清空');

  // 2. 查所有印章
  const seals = await p.seal.findMany({ select: { id: true, name: true } });
  const pkgs = await p.sealPackage.findMany({ select: { id: true, name: true } });
  const sealMap = {};
  seals.forEach(s => sealMap[s.name] = s.id);
  const pkgMap = {};
  pkgs.forEach(pkg => pkgMap[pkg.name] = pkg.id);
  console.log(`[2] 印章 ${seals.length} 个，套餐 ${pkgs.length} 个`);

  // 3. 创建 4 个新场景
  const enterprise = await p.sealScene.create({
    data: { name: '企业刻章', description: '公章、财务章、合同章、法人章、发票章等企业用章',
      icon: 'company', bgColor: '#4A90D9', sort: 1, status: 1, sceneType: 'scene' }
  });
  const personal = await p.sealScene.create({
    data: { name: '个人印章', description: '个人签名章、拆迁买房、公证等个人用章',
      icon: 'person', bgColor: '#52C41A', sort: 2, status: 1, sceneType: 'scene' }
  });
  const electronic = await p.sealScene.create({
    data: { name: '电子印章', description: '电子签章，在线签署，无需快递',
      icon: 'electronic', bgColor: '#FA8C16', sort: 3, status: 1, sceneType: 'scene' }
  });
  const record = await p.sealScene.create({
    data: { name: '刻章备案查询', description: '章铭网备案查询，输入印章名称即可查询备案信息',
      icon: 'search', bgColor: '#722ED1', sort: 4, status: 1, sceneType: 'scene' }
  });
  console.log('[3] 4 个新场景已创建');

  // 4. 企业刻章印章列表（用真实名称）
  const enterpriseSeals = [
    '公章', '财务专用章', '合同专用章', '法人章', '发票专用章',
    '中英文对照公章', '中英文合同章',
    '手动钢印章', '自动钢印章',
    '业务专用章', '销售合同章', '发货专用章', '技术专用章', '质检章',
    '收据专用章', '委员会章', '生产办公室章', '人事专用章',
    '授权专用章', '资质专用章', '质量管理部章', '项目章',
    '办事机构章', '组委会章', '其他章',
    '一级造价工程师', '一级建造师', '一级结构工程师',
    '注册监理工程师', '二级建筑师', '电气工程师章',
    '房地产评估师', '会计师章', '项目经理章',
    '二级造价工程师', '二级建造师', '二级结构工程师',
    '一级建筑师章', '土木工程师章', '化工工程师章',
    '执业律师章', '税务师章', '其他执业章',
  ];
  const personalSeals = ['个人签名章', '拆迁买房用章', '公证使用章', '企业员工用章'];

  // 5. 绑定印章
  let eCnt = 0, pCnt = 0;
  for (const name of enterpriseSeals) {
    if (sealMap[name]) {
      await p.sealSceneSeal.create({ data: { sceneId: enterprise.id, sealId: sealMap[name], sort: eCnt++ } });
    } else {
      console.warn('  [WARN] 企业印章不存在: ' + name);
    }
  }
  for (const name of personalSeals) {
    if (sealMap[name]) {
      await p.sealSceneSeal.create({ data: { sceneId: personal.id, sealId: sealMap[name], sort: pCnt++ } });
    } else {
      console.warn('  [WARN] 个人印章不存在: ' + name);
    }
  }
  console.log(`[4] 企业刻章绑定 ${eCnt} 个，个人印章绑定 ${pCnt} 个`);

  // 6. 绑定套餐（全部归企业刻章）
  let pkgCnt = 0;
  for (const name of Object.keys(pkgMap)) {
    await p.sealScenePackage.create({ data: { sceneId: enterprise.id, packageId: pkgMap[name], sort: pkgCnt++ } });
  }
  console.log(`[5] 套餐绑定 ${pkgCnt} 个（电子印章/刻章备案查询无套餐）`);

  // 7. 验证
  console.log('\n=== 验证 ===');
  const allScenes = await p.sealScene.findMany({
    include: { _count: { select: { sealSceneSeals: true, sealScenePackages: true } } }
  });
  allScenes.forEach(s => {
    console.log('  ' + s.name + ': 印章 ' + s._count.sealSceneSeals + ' 个，套餐 ' + s._count.sealScenePackages + ' 个');
  });

  await p.$disconnect();
  console.log('\n完成!');
}

main().catch(async e => {
  console.error('ERROR:', e.message);
  await p.$disconnect();
  process.exit(1);
});
