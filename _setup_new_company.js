require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const SCENE_ID = '28bdff21-e957-49f8-a926-b4e4af74b4ea';

const SEALS = {
  '公章': 'b5410e9e-d48c-4af3-92f7-8322901c146b',
  '财务专用章': 'f5241b71-2def-4caa-9592-164b6ac96d54',
  '法人章': '6faab30d-7e72-42ff-824f-c68515e3b1a2',
  '发票专用章': 'd21f1413-b15b-4278-8989-a09c527b5087',
  '合同专用章': '4eae5ea6-6904-4b2c-958a-e6267c14dab6',
};

const PACKAGES = [
  { name: '公章+财务专用章+法人章', seals: ['公章', '财务专用章', '法人章'], price: '240' },
  { name: '公章+财务专用章+发票专用章+法人章', seals: ['公章', '财务专用章', '发票专用章', '法人章'], price: '280' },
  { name: '公章+财务专用章+发票专用章+合同专用章+法人章', seals: ['公章', '财务专用章', '发票专用章', '合同专用章', '法人章'], price: '340' },
];

async function main() {
  // 清除旧关联和套餐
  const oldJoins = await p.sealScenePackage.findMany({ where: { sceneId: SCENE_ID }, select: { packageId: true } });
  await p.sealScenePackage.deleteMany({ where: { sceneId: SCENE_ID } });
  if (oldJoins.length > 0) {
    await p.sealPackage.deleteMany({ where: { id: { in: oldJoins.map(j => j.packageId) } } });
  }
  await p.sealSceneSeal.deleteMany({ where: { sceneId: SCENE_ID } });
  console.log('✓ 清除旧数据');

  // 挂印章
  const sealNames = Object.keys(SEALS);
  for (let i = 0; i < sealNames.length; i++) {
    await p.sealSceneSeal.create({ data: { sceneId: SCENE_ID, sealId: SEALS[sealNames[i]], sort: i + 1 } });
  }
  console.log(`✓ 挂入印章: ${sealNames.join(', ')}`);

  // 建套餐
  for (let i = 0; i < PACKAGES.length; i++) {
    const pkg = PACKAGES[i];
    const pkgId = require('uuid').v4();
    await p.sealPackage.create({
      data: {
        id: pkgId,
        name: pkg.name,
        price: pkg.price,
        sealIds: pkg.seals.map(s => SEALS[s]),
        sort: i + 1,
      },
    });
    await p.sealScenePackage.create({ data: { sceneId: SCENE_ID, packageId: pkgId, sort: i + 1 } });
    console.log(`✓ 套餐[${i + 1}]: ${pkg.name} (￥${pkg.price})`);
  }
  console.log('\n完成!');
}

main().then(() => { process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
