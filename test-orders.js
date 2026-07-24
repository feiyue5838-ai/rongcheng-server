const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$connect();
  console.log('connected');
  const result = await prisma.sealOrder.update({
    where: { id: '0e3ee830-f1b3-4397-b5cd-06e346fe6b63' },
    data: { status: 7, statusText: '售后中' }
  });
  console.log('已更新:', result.orderNo, '=> status=7 售后中');
  await prisma.$disconnect();
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
