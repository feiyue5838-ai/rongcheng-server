// 种子数据：为全部报纸生成初始版面（头版 + 分类广告版）
// 用法：cd D:\rongcheng-admin\server && node seed_sections.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 按报纸级别定刊例价：3=国家级 2=省级 1=普通
const PRICE_BY_LEVEL = {
  3: { front: 5000, classified: 2000 },
  2: { front: 2000, classified: 800 },
  1: { front: 800, classified: 300 },
};

async function main() {
  const newspapers = await prisma.newspapers.findMany({
    select: { id: true, name: true, level: true },
    orderBy: { sort: 'asc' },
  });
  console.log('报纸总数:', newspapers.length);

  // 统计级别分布
  const levelDist = {};
  newspapers.forEach(n => { levelDist[n.level ?? 1] = (levelDist[n.level ?? 1] || 0) + 1 });
  console.log('级别分布:', JSON.stringify(levelDist));

  // 已有版面检查（幂等）
  const existing = await prisma.newspaper_sections.count();
  if (existing > 0) {
    console.log(`已有 ${existing} 条版面记录，为避免重复，本次不执行。如需重建请先清空表。`);
    return;
  }

  let created = 0;
  for (const n of newspapers) {
    const p = PRICE_BY_LEVEL[n.level ?? 1] || PRICE_BY_LEVEL[1];
    await prisma.newspaper_sections.createMany({
      data: [
        {
          newspaper_id: n.id,
          name: '头版',
          category: '头版',
          list_price: p.front,
          deadline_time: '17:00',
          publish_cycle: '次日见报',
          sort: 1,
          status: 1,
          remark: '初始默认版面',
        },
        {
          newspaper_id: n.id,
          name: '分类广告版',
          category: '分类广告',
          list_price: p.classified,
          deadline_time: '16:00',
          publish_cycle: '次日见报',
          sort: 2,
          status: 1,
          remark: '初始默认版面',
        },
      ],
    });
    created += 2;
  }
  console.log('已创建版面:', created);

  // 抽查
  const sample = await prisma.newspaper_sections.findFirst({ include: { newspaper: { select: { name: true } } } });
  console.log('抽查:', JSON.stringify({ name: sample.name, category: sample.category, listPrice: sample.list_price.toString(), newspaper: sample.newspaper.name }));
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
