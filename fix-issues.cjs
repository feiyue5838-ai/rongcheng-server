const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // 查2条历史无分配订单
  const orders = await p.sealOrder.findMany({
    where: { orderNo: { in: ['RC20260710008', 'RC20260710005'] } },
    select: { id: true, orderNo: true, module: true, status: true, assignmentStatus: true, createdAt: true }
  });
  console.log('=== 历史订单 ===');
  orders.forEach(o => console.log(JSON.stringify(o)));

  if (orders.length > 0) {
    const assigns = await p.orderAssignment.findMany({
      where: { orderId: { in: orders.map(o => o.id) } }
    });
    console.log('分配记录数:', assigns.length);
  }

  // 查乱码模板
  const tmpl = await p.newspaperTemplate.findUnique({
    where: { id: '2a516a9b-3a5a-4a6e-b4cd-bc0b8f8cc03d' },
    select: { id: true, name: true, content: true, categoryId: true, status: true }
  });
  if (tmpl) {
    console.log('\n=== 乱码模板 ===');
    console.log('name:', tmpl.name);
    console.log('content:', JSON.stringify(tmpl.content).substring(0, 200));
    console.log('categoryId:', tmpl.categoryId);
    console.log('status:', tmpl.status);
  } else {
    console.log('\n乱码模板不存在');
  }

  await p.$disconnect();
})();
