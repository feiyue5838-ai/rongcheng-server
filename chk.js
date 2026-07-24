const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$connect();
  const order = await prisma.sealOrder.findUnique({ where: { id: '0e3ee830-f1b3-4397-b5cd-06e346fe6b63' } });
  console.log('订单状态:', order.status, order.statusText);
  console.log('remark:', order.remark);
  await prisma.$disconnect();
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
