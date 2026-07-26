const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();
prisma.seals.update({
  where: { id: 'cb3f024f-2108-4fb1-a47c-5578e032dd71' },
  data: { name: '公章' }
}).then(r => {
  console.log('修复成功:', r.name, '¥' + r.price);
  return prisma.$disconnect();
}).catch(e => {
  console.error('错误:', e.message);
  return prisma.$disconnect();
});
