require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const SCENE_IDS = {
  '个体户': '382086a4-c5a2-49b5-b70c-67a1eb85ba12',
  '公司': 'afd862ed-208d-4a11-b3ff-ebee46f2ff37',
};

const SEALS = {
  '公章': 'b5410e9e-d48c-4af3-92f7-8322901c146b',
  '财务专用章': 'f5241b71-2def-4caa-9592-164b6ac96d54',
  '发票专用章': 'd21f1413-b15b-4278-8989-a09c527b5087',
  '法人章': '6faab30d-7e72-42ff-824f-c68515e3b1a2',
  '合同专用章': '4eae5ea6-6904-4b2c-958a-e6267c14dab6',
  '中英文对照公章': '108a0e96-79e4-48b9-890d-d64f746d94c3',
  '中英文合同章': 'fe024afa-6f72-44c1-90d6-dace4c7aa432',
};

const PACKAGES = [
  { name: '公章+财务专用章+法人章', seals: ['公章', '财务专用章', '法人章'], price: '260' },
  { name: '公章+财务专用章+发票专用章+法人章', seals: ['公章', '财务专用章', '发票专用章', '法人章'], price: '300' },
  { name: '公章+财务专用章+发票专用章', seals: ['公章', '财务专用章', '发票专用章'], price: '240' },
  { name: '公章+财务专用章+合同专用章', seals: ['公章', '财务专用章', '合同专用章'], price: '260' },
  { name: '公章+合同专用章+发票专用章', seals: ['公章', '合同专用章', '发票专用章'], price: '260' },
  { name: '公章+财务专用章+发票专用章+合同专用章', seals: ['公章', '财务专用章', '发票专用章', '合同专用章'], price: '320' },
  { name: '公章+财务专用章+发票专用章+合同专用章+法人章', seals: ['公章', '财务专用章', '发票专用章', '合同专用章', '法人章'], price: '380' },
];

async function main() {
  for (const [sceneName, sceneId] of Object.entries(SCENE_IDS)) {
    console.log(`\n=== ${sceneName} ===`);

    // 删除旧关联（先删join表，再删旧套餐）
    const oldJoins = await p.sealScenePackage.findMany({ where: { sceneId }, select: { packageId: true } });
    await p.sealScenePackage.deleteMany({ where: { sceneId } });
    if (oldJoins.length > 0) {
      await p.sealPackage.deleteMany({ where: { id: { in: oldJoins.map(j => j.packageId) } } });
    }
    await p.sealSceneSeal.deleteMany({ where: { sceneId } });
    console.log('  ✓ 清除旧关联');

    // 挂印章
    const sealNames = Object.keys(SEALS);
    for (let i = 0; i < sealNames.length; i++) {
      await p.sealSceneSeal.create({ data: { sceneId, sealId: SEALS[sealNames[i]], sort: i + 1 } });
    }
    console.log(`  ✓ 挂入印章: ${sealNames.join(', ')}`);

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
      await p.sealScenePackage.create({
        data: { sceneId, packageId: pkgId, sort: i + 1 },
      });
      console.log(`  ✓ 套餐[${i + 1}]: ${pkg.name} (${pkg.price}元)`);
    }
  }
  console.log('\n完成!');
}

main().then(() => { process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
