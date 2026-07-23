const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({ orderBy: { createdAt: 'desc' }, take: 3 });
  console.log('--- Recent Users ---');
  users.forEach(u => console.log(JSON.stringify({ id: u.id, openid: u.openid, status: u.status, createdAt: u.createdAt })));
  const orders = await p.sealOrder.findMany({ where: { module: 'bookkeeping' }, orderBy: { createdAt: 'desc' }, take: 5 });
  console.log('--- Bookkeeping Orders ---');
  orders.forEach(o => console.log(JSON.stringify({
    id: o.id, orderNo: o.orderNo, userId: o.userId, module: o.module,
    totalPrice: o.totalPrice, status: o.status,
    remark: o.remark && o.remark.substring(0, 200),
    createdAt: o.createdAt
  })));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
