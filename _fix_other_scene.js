require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const otherScene = await p.sealScene.findFirst({ where: { name: '其他章名' } });

  // 获取其他章名下所有印章
  const assocs = await p.sealSceneSeal.findMany({ where: { sceneId: otherScene.id }, include: { seal: true } });

  // 电子印章关键字
  const electronicNames = ['电子公章', '电子财务章', '电子合同章', '电子法人章', '电子发票章', '电子个人签名章'];
  const regionNames = ['省', '市', '自治区', '特别行政区'];

  let removed = 0;
  for (const assoc of assocs) {
    const isRegion = regionNames.some(r => assoc.seal.name.endsWith(r));
    if (isRegion) {
      await p.sealSceneSeal.delete({ where: { sceneId_sealId: { sceneId: assoc.sceneId, sealId: assoc.sealId } } });
      removed++;
      console.log(`  删除: ${assoc.seal.name}`);
    }
  }

  const remaining = await p.sealSceneSeal.count({ where: { sceneId: otherScene.id } });
  console.log(`\n✓ 其他章名: 删除${removed}个省印章，剩余${remaining}个（全部为电子印章）`);
}

main()
  .then(() => { process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
