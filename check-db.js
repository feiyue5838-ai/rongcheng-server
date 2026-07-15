const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:wuhongyuan198911@localhost:5432/rongcheng?client_encoding=UTF8'
    }
  }
});
(async () => {
  const nc = await p.newspaperCategory.findMany({ orderBy: { sort: 'asc' } });
  console.log('报纸分类:', nc.length, '条');
  nc.forEach(c => console.log(' ', c.id.substring(0,8), c.name, 'sort='+c.sort, 'status='+c.status));
  const sc = await p.sealCategory.findMany({ orderBy: { sort: 'asc' } });
  console.log('印章分类:', sc.length, '条');
  sc.forEach(c => console.log(' ', c.id.substring(0,8), c.name, 'sort='+c.sort, 'status='+c.status));
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
