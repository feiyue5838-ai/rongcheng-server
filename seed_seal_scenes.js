const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. 删除所有旧场景的关联
  await prisma.sealSceneSeal.deleteMany({});
  await prisma.sealScenePackage.deleteMany({});
  console.log('✓ 清除旧场景印章关联');

  // 2. 删除所有旧场景
  const oldScenes = await prisma.sealScene.findMany({ where: { sceneType: 'scene' } });
  for (const s of oldScenes) {
    await prisma.sealScene.delete({ where: { id: s.id } });
  }
  console.log('✓ 删除旧场景:', oldScenes.map(s => s.name).join(', '));

  // 3. 定义新场景
  const newScenes = [
    { name: '个体户', description: '个体工商户刻章', icon: 'person', bgColor: '#52C41A', sort: 1 },
    { name: '公司', description: '公司/企业刻章', icon: 'company', bgColor: '#4A90D9', sort: 2 },
    { name: '新成立开户必备章', description: '新成立企业开户所需印章', icon: 'new', bgColor: '#FA8C16', sort: 3 },
    { name: '单位名称变更必备章', description: '单位名称变更后所需印章', icon: 'change', bgColor: '#722ED1', sort: 4 },
    { name: '单位法人变更必备章', description: '法人变更后所需印章', icon: 'legal', bgColor: '#EB2F96', sort: 5 },
    { name: '政府事业点位', description: '政府机关/事业单位刻章', icon: 'gov', bgColor: '#13C2C2', sort: 6 },
    { name: '钢印章', description: '手动/自动钢印章', icon: 'steel', bgColor: '#8C8C8C', sort: 7 },
    { name: '其他章名', description: '其他类型印章', icon: 'other', bgColor: '#BFBFBF', sort: 8 },
  ];

  // 4. 创建新场景
  const created = [];
  for (const s of newScenes) {
    const scene = await prisma.sealScene.create({
      data: { ...s, status: 1, sceneType: 'scene' }
    });
    created.push(scene);
    console.log('✓ 创建场景:', s.name, '→', scene.id);
  }

  // 5. 获取所有印章，按分类分组
  const seals = await prisma.seal.findMany({ where: { status: 1 } });
  const sealsByCat = {};
  for (const seal of seals) {
    const catId = seal.categoryId;
    if (!sealsByCat[catId]) sealsByCat[catId] = [];
    sealsByCat[catId].push(seal);
  }

  // 获取分类映射
  const cats = await prisma.sealCategory.findMany();
  const catMap = {};
  for (const c of cats) catMap[c.id] = c.name;

  // 6. 关联印章到场景
  // 个体户场景 → 挂所有印章（通用）
  const sceneMap = {};
  for (const s of created) sceneMap[s.name] = s;

  // 公司 → 公章+财务章+法人章+合同章
  // 新成立开户必备章 → 公章+财务章+法人章
  // 单位名称变更必备章 → 公章+合同章
  // 单位法人变更必备章 → 法人章+公章
  // 钢印章 → 手动钢印章+自动钢印章
  const sceneSeals = [
    // 个体户：挂所有印章（通用场景）
    ...seals.map(s => ({ sceneId: sceneMap['个体户'].id, sealId: s.id, sort: 0 })),
    // 公司：企业公章、财务专用章、法人章、合同专用章、发票专用章
    ...(sealsByCat['c0000001-0000-0000-0000-000000000001'] || []).map(s => ({ sceneId: sceneMap['公司'].id, sealId: s.id, sort: 0 })),
    ...(sealsByCat['c0000001-0000-0000-0000-000000000003'] || []).map(s => ({ sceneId: sceneMap['公司'].id, sealId: s.id, sort: 0 })),
    ...(sealsByCat['c0000001-0000-0000-0000-000000000004'] || []).map(s => ({ sceneId: sceneMap['公司'].id, sealId: s.id, sort: 0 })),
    // 新成立开户必备章：公章+财务章+法人章
    ...(sealsByCat['c0000001-0000-0000-0000-000000000001'] || []).map(s => ({ sceneId: sceneMap['新成立开户必备章'].id, sealId: s.id, sort: 0 })),
    ...(sealsByCat['c0000001-0000-0000-0000-000000000003'] || []).map(s => ({ sceneId: sceneMap['新成立开户必备章'].id, sealId: s.id, sort: 0 })),
    ...(sealsByCat['c0000001-0000-0000-0000-000000000004'] || []).map(s => ({ sceneId: sceneMap['新成立开户必备章'].id, sealId: s.id, sort: 0 })),
    // 单位名称变更必备章：公章+合同专用章+中英文对照公章
    ...(sealsByCat['c0000001-0000-0000-0000-000000000001'] || []).filter(s => ['公章','合同专用章','中英文对照公章'].includes(s.name)).map(s => ({ sceneId: sceneMap['单位名称变更必备章'].id, sealId: s.id, sort: 0 })),
    // 单位法人变更必备章：公章+法人章
    ...(sealsByCat['c0000001-0000-0000-0000-000000000001'] || []).filter(s => ['公章'].includes(s.name)).map(s => ({ sceneId: sceneMap['单位法人变更必备章'].id, sealId: s.id, sort: 0 })),
    ...(sealsByCat['c0000001-0000-0000-0000-000000000004'] || []).map(s => ({ sceneId: sceneMap['单位法人变更必备章'].id, sealId: s.id, sort: 0 })),
  ];

  // 找钢印章
  const steelSeals = seals.filter(s => s.name.includes('钢印'));
  for (const s of steelSeals) {
    sceneSeals.push({ sceneId: sceneMap['钢印章'].id, sealId: s.id, sort: 0 });
  }

  // 其他章名：挂剩余未分配的
  const assignedSealIds = new Set(sceneSeals.map(x => x.sealId));
  for (const s of seals) {
    if (!assignedSealIds.has(s.id)) {
      sceneSeals.push({ sceneId: sceneMap['其他章名'].id, sealId: s.id, sort: 0 });
    }
  }

  for (const assoc of sceneSeals) {
    await prisma.sealSceneSeal.upsert({
      where: { sceneId_sealId: { sceneId: assoc.sceneId, sealId: assoc.sealId } },
      update: {},
      create: assoc,
    });
  }
  console.log('✓ 关联印章到场景:', sceneSeals.length, '条');

  // 7. 验证
  const verify = await prisma.sealScene.findMany({ where: { sceneType: 'scene' }, orderBy: { sort: 'asc' } });
  console.log('\n=== 最终场景列表 ===');
  for (const s of verify) {
    const count = await prisma.sealSceneSeal.count({ where: { sceneId: s.id } });
    console.log(`  [${s.sort}] ${s.name} (${count}个印章)`);
  }
}

main()
  .then(() => { console.log('\n完成!'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
