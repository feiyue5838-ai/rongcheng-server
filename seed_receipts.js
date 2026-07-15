// 直接用 Prisma 写入交付回执（模拟门店"发货"动作产生的回执）
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LONGQUAN_STORE_ID = '52a5fe98-b213-4dab-bac0-043795445ee0';

async function main() {
  console.log('='.repeat(80));
  console.log('补充交付回执');
  console.log('='.repeat(80));

  // 查找所有 status >= 3 且无回执的订单
  const orders = await prisma.sealOrder.findMany({
    where: { status: { gte: 3 } },
    include: {
      receipts: true,
      assignment: { include: { store: true } }
    }
  });

  const ordersNeedingReceipts = orders.filter(o => !o.receipts || o.receipts.length === 0);
  console.log(`\n发现 ${ordersNeedingReceipts.length} 笔已发货/完成但无回执的订单\n`);

  const RECEIPT_TYPES = ['制作完成照片', '打包照片', '发货面单'];

  for (const order of ordersNeedingReceipts) {
    const storeId = order.assignment ? order.assignment.storeId : LONGQUAN_STORE_ID;
    const orderNo = order.orderNo;
    const expressNo = order.expressNo || ('SF' + Math.random().toString().slice(2, 14));
    const expressCompany = order.expressCompany || '顺丰速运';

    console.log(`处理 ${orderNo} (订单状态=${order.status}, 分配=${order.assignment ? order.assignment.store.name : '无'})`);

    // 创建 3 张回执
    const receiptData = RECEIPT_TYPES.map((remark, i) => ({
      id: require('uuid').v4(),
      orderId: order.id,
      storeId,
      type: 'photo',
      url: `https://img.yoursite.com/receipts/${orderNo}_${i + 1}.jpg`,
      remark,
    }));

    // 批量写入回执
    await prisma.deliveryReceipt.createMany({ data: receiptData });

    // 更新快递信息（如果原订单没有的话）
    if (!order.expressNo) {
      await prisma.sealOrder.update({
        where: { id: order.id },
        data: { expressCompany, expressNo },
      });
    }

    // 如果 assignment.status 仍为 1/2，需同步更新
    if (order.assignment && order.assignment.status < 3) {
      await prisma.orderAssignment.update({
        where: { id: order.assignment.id },
        data: { status: 3, statusText: '已发货', completedAt: new Date() },
      });
    }

    // 如果 deliveryStatus 为空，更新
    if (!order.deliveryStatus) {
      await prisma.sealOrder.update({
        where: { id: order.id },
        data: { deliveryStatus: 1, deliveredAt: new Date() },
      });
    }

    console.log(`  ✅ 写入 ${receiptData.length} 份回执`);
  }

  // 验证
  console.log('\n--- 验证结果 ---');
  const allOrders = await prisma.sealOrder.findMany({
    where: { status: { gte: 3 } },
    include: { receipts: true, assignment: { include: { store: { select: { name: true } } } } }
  });

  let totalReceipts = 0;
  for (const o of allOrders) {
    const cnt = o.receipts ? o.receipts.length : 0;
    totalReceipts += cnt;
    const storeName = o.assignment ? o.assignment.store.name : '-';
    const statusText = ['待支付', '待发货', '制作中', '已发货', '配送中', '已完成', '已取消'][o.status] || o.status;
    console.log(`  ${o.orderNo} | ${statusText} | ${storeName} | ${cnt} 份回执`);
  }

  console.log(`\n合计: ${allOrders.length} 笔已发货订单，共 ${totalReceipts} 份回执`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
