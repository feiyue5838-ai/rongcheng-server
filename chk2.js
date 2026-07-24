const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$connect();
  const records = await prisma.sealOrder.findMany({
    where: { status: { in: [8, 9] } },
    select: { id: true, orderNo: true, module: true, status: true, payPrice: true, createdAt: true }
  });
  console.log('退款记录:', JSON.stringify(records, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
