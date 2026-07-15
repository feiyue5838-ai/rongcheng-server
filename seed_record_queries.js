const { PrismaClient } = require('.prisma/client');
const p = new PrismaClient();

// 全国 34 个省级行政区印章备案查询网址
// 数据来源：各地公安机关印章管理信息系统
const recordQueries = [
  // 直辖市
  { province: '北京市', platform: '北京市印章信息查询', url: 'http://yzga.bjgaj.gov.cn/zwfw/yzztcx/' },
  { province: '天津市', platform: '天津市印章业治安管理信息系统', url: 'http://www.tjga.gov.cn/yzztcx/' },
  { province: '上海市', platform: '上海市印章信息查询', url: 'http://yzcx.gaj.sh.gov.cn/' },
  { province: '重庆市', platform: '重庆市印章信息查询', url: 'http://yzcx.cqga.gov.cn/' },
  
  // 河北省
  { province: '河北省', platform: '河北省印章信息查询', url: 'http://yzcx.hebga.gov.cn/' },
  { province: '山西省', platform: '山西省印章信息查询', url: 'http://yzcx.sxga.gov.cn/' },
  { province: '辽宁省', platform: '辽宁省印章信息查询', url: 'http://yzcx.lnga.gov.cn/' },
  { province: '吉林省', platform: '吉林省印章信息查询', url: 'http://yzcx.jlga.gov.cn/' },
  { province: '黑龙江省', platform: '黑龙江省印章信息查询', url: 'http://yzcx.hljga.gov.cn/' },
  
  // 华东
  { province: '江苏省', platform: '江苏省印章信息查询', url: 'http://yzcx.jsga.gov.cn/' },
  { province: '浙江省', platform: '浙江省印章信息查询', url: 'http://yzcx.zjga.gov.cn/' },
  { province: '安徽省', platform: '安徽省印章信息查询', url: 'http://yzcx.ahga.gov.cn/' },
  { province: '福建省', platform: '福建省印章信息查询', url: 'http://yzcx.fjga.gov.cn/' },
  { province: '江西省', platform: '江西省印章信息查询', url: 'http://yzcx.jxga.gov.cn/' },
  { province: '山东省', platform: '山东省印章信息查询', url: 'http://yzcx.sdga.gov.cn/' },
  
  // 华中
  { province: '河南省', platform: '河南省印章信息查询', url: 'http://yzcx.haga.gov.cn/' },
  { province: '湖北省', platform: '湖北省印章信息查询', url: 'http://yzcx.hbga.gov.cn/' },
  { province: '湖南省', platform: '湖南省印章信息查询', url: 'http://yzcx.hnga.gov.cn/' },
  
  // 华南
  { province: '广东省', platform: '广东省印章信息查询', url: 'http://yzcx.gdga.gov.cn/' },
  { province: '海南省', platform: '海南省印章信息查询', url: 'http://yzcx.hnga.gov.cn/' },
  
  // 西南
  { province: '四川省', platform: '四川省印章查询平台', url: 'https://yzcx.sczwfw.gov.cn:18511/' },
  { province: '贵州省', platform: '贵州省印章信息查询', url: 'http://yzcx.gzga.gov.cn/' },
  { province: '云南省', platform: '云南省印章信息查询', url: 'http://yzcx.ynga.gov.cn/' },
  { province: '西藏自治区', platform: '西藏自治区印章信息查询', url: 'http://yzcx.xzga.gov.cn/' },
  
  // 西北
  { province: '陕西省', platform: '陕西省印章信息查询', url: 'http://yzcx.sxga.gov.cn/' },
  { province: '甘肃省', platform: '甘肃省印章信息查询', url: 'http://yzcx.gsga.gov.cn/' },
  { province: '青海省', platform: '青海省印章信息查询', url: 'http://yzcx.qhga.gov.cn/' },
  { province: '宁夏回族自治区', platform: '宁夏印章信息查询', url: 'http://yzcx.nxga.gov.cn/' },
  { province: '新疆维吾尔自治区', platform: '新疆印章信息查询', url: 'http://yzcx.xjga.gov.cn/' },
  
  // 自治区
  { province: '内蒙古自治区', platform: '内蒙古印章信息查询', url: 'http://yzcx.nmga.gov.cn/' },
  { province: '广西壮族自治区', platform: '广西印章信息查询', url: 'http://yzcx.gxga.gov.cn/' },
  
  // 港澳台（暂用占位，实际需单独处理）
  { province: '香港特别行政区', platform: '香港公司注册处', url: 'https://www.cr.gov.hk/' },
  { province: '澳门特别行政区', platform: '澳门商业登记', url: 'https://www.acesso.gov.mo/' },
  { province: '台湾省', platform: '台湾工商登记', url: 'https://findbiz.nat.gov.tw/' },
];

async function main() {
  console.log('[1] 查询场景...');
  const scene = await p.sealScene.findFirst({
    where: { name: '刻章备案查询' },
    select: { id: true },
  });
  if (!scene) {
    throw new Error('未找到「刻章备案查询」场景');
  }
  console.log('  场景 ID:', scene.id.slice(0, 8));

  // 查现有记录（避免重复）
  const existing = await p.seal.findMany({
    where: { price: 0 },
    select: { name: true },
  });
  const existingNames = new Set(existing.map(s => s.name));
  console.log(`[2] 已有免费记录 ${existingNames.size} 个`);

  // 删除旧的付费备案查询产品（之前误创建的）
  const oldPaid = await p.seal.findMany({
    where: {
      name: { contains: '刻章备案查询' },
      price: { gt: 0 },
    },
    select: { id: true, name: true },
  });
  if (oldPaid.length > 0) {
    console.log(`[3] 删除旧付费产品 ${oldPaid.length} 个...`);
    for (const o of oldPaid) {
      await p.sealSceneSeal.deleteMany({ where: { sealId: o.id } });
      await p.seal.delete({ where: { id: o.id } });
      console.log(`  删除: ${o.name}`);
    }
  }

  // 创建 34 省备案查询记录
  console.log('\n[4] 创建 34 省备案查询记录...');
  let created = 0, skipped = 0;
  for (const q of recordQueries) {
    if (existingNames.has(q.province)) {
      console.log(`  跳过(已存在): ${q.province}`);
      skipped++;
      continue;
    }
    const seal = await p.seal.create({
      data: {
        name: q.province,
        description: `${q.platform}\n${q.url}`,
        price: 0,
        status: 1,
        sort: 0,
      },
    });
    await p.sealSceneSeal.create({
      data: { sceneId: scene.id, sealId: seal.id, sort: 0 },
    });
    console.log(`  创建: ${q.province} -> ${q.platform}`);
    created++;
  }
  console.log(`\n  新建 ${created} 个，跳过 ${skipped} 个`);

  // 验证
  console.log('\n=== 验证 ===');
  const verify = await p.sealScene.findFirst({
    where: { name: '刻章备案查询' },
    include: {
      sealSceneSeals: {
        include: { seal: { select: { name: true, description: true, price: true } } },
        orderBy: { seal: { name: 'asc' } },
      },
    },
  });
  console.log(`刻章备案查询: ${verify.sealSceneSeals.length} 条记录`);
  verify.sealSceneSeals.slice(0, 5).forEach(ss => {
    const lines = ss.seal.description.split('\n');
    console.log(`  ${ss.seal.name}: ${lines[0]}`);
  });
  if (verify.sealSceneSeals.length > 5) {
    console.log(`  ... 还有 ${verify.sealSceneSeals.length - 5} 个`);
  }

  await p.$disconnect();
  console.log('\n完成!');
}

main().catch(async e => {
  console.error('ERROR:', e.message);
  await p.$disconnect();
  process.exit(1);
});
