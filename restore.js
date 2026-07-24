const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$connect();
  const order = await prisma.sealOrder.update({
    where: { id: '0e3ee830-f1b3-4397-b5cd-06e346fe6b63' },
    data: { status: 2, statusText: '已支付', remark: '{"taxpayerType":"small","cycle":"year","invoice":"none","social":"none","fund":"none","phone":"13900139000"}' }
  });
  console.log('已还原:', order.orderNo, '=> status=2 已支付');
  await prisma.$disconnect();
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
