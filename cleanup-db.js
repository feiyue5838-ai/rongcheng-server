const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:wuhongyuan198911@localhost:5432/rongcheng?client_encoding=UTF8'
    }
  }
});

async function main() {
  // 清理所有分类并重建
  await p.sealCategory.deleteMany();
  console.log('✓ 删除所有印章分类');

  await p.newspaperCategory.deleteMany();
  console.log('✓ 删除所有报纸分类');

  const sealData = [
    { id: 'c0000001-0000-0000-0000-000000000001', name: '企业公章', icon: 'business', sort: 1, status: 1 },
    { id: 'c0000001-0000-0000-0000-000000000002', name: '个人印章', icon: 'personal', sort: 2, status: 1 },
    { id: 'c0000001-0000-0000-0000-000000000003', name: '财务专用章', icon: 'finance', sort: 3, status: 1 },
    { id: 'c0000001-0000-0000-0000-000000000004', name: '法人章', icon: 'legal', sort: 4, status: 1 },
    { id: 'c0000001-0000-0000-0000-000000000005', name: '电子印章', icon: 'electronic', sort: 5, status: 1 },
  ];
  for (const cat of sealData) {
    const created = await p.sealCategory.create({ data: cat });
    console.log('✓ 印章: ' + created.name + ' (id=' + created.id.substring(0,8) + ')');
  }

  const newsData = [
    { id: 'n0000001-0000-0000-0000-000000000001', name: '注销公告', icon: 'cancel', sort: 1, status: 1 },
    { id: 'n0000001-0000-0000-0000-000000000002', name: '道歉声明', icon: 'apology', sort: 2, status: 1 },
    { id: 'n0000001-0000-0000-0000-000000000003', name: '法院公告', icon: 'court', sort: 3, status: 1 },
    { id: 'n0000001-0000-0000-0000-000000000004', name: '拍卖公告', icon: 'auction', sort: 4, status: 1 },
    { id: 'n0000001-0000-0000-0000-000000000005', name: '证件挂失', icon: 'lost', sort: 5, status: 1 },
    { id: 'n0000001-0000-0000-0000-000000000006', name: '债权公告', icon: 'creditor', sort: 6, status: 1 },
    { id: 'n0000001-0000-0000-0000-000000000007', name: '吸收合并公告', icon: 'merger', sort: 7, status: 1 },
  ];
  for (const cat of newsData) {
    const created = await p.newspaperCategory.create({ data: cat });
    console.log('✓ 报纸: ' + created.name + ' (id=' + created.id.substring(0,8) + ', sort=' + created.sort + ')');
  }

  // 验证
  console.log('\n=== 验证 ===');
  const finalSeals = await p.sealCategory.findMany({ orderBy: { sort: 'asc' } });
  const finalNews = await p.newspaperCategory.findMany({ orderBy: { sort: 'asc' } });
  console.log('印章分类: ' + finalSeals.length + ' 条');
  finalSeals.forEach(c => console.log('  ' + c.sort + '. ' + c.name));
  console.log('报纸分类: ' + finalNews.length + ' 条');
  finalNews.forEach(c => console.log('  ' + c.sort + '. ' + c.name + ' (status=' + c.status + ')'));

  await p.$disconnect();
  console.log('\n✅ 完成!');
}

main().catch(async (e) => {
  console.error('❌ 错误:', e.message);
  await p.$disconnect();
  process.exit(1);
});
