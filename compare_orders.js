// 对比管理后台订单列表 API 与数据库实际状态
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.sealOrder.findMany({
    include: {
      assignment: {
        include: {
          store: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const statusMap = {
    0: '待支付', 1: '待发货', 2: '制作中', 3: '已发货', 4: '配送中', 5: '已完成', 6: '已取消'
  };
  const assignStatusMap = {
    0: '待接单', 1: '已接单', 2: '制作中', 3: '已发货', 4: '已完成', 5: '已拒绝'
  };

  console.log('DB 实际状态 vs API 返回字段对比');
  console.log('='.repeat(100));

  for (const o of orders) {
    const storeStatus = o.assignment ? assignStatusMap[o.assignment.status] : '未分配';
    const storeName = o.assignment ? o.assignment.store.name : '-';

    // 模拟管理后台 API 返回的字段
    const apiAssignStatus = o.assignment ? assignStatusMap[o.assignment.status] : null;
    const apiStoreName = o.assignment ? o.assignment.store.name : null;
    const apiStoreId = o.assignment ? o.assignment.storeId : null;

    console.log(`\n${o.orderNo} | ${o.module} | ${o.type}`);
    console.log(`  订单状态: [${o.status}] ${statusMap[o.status]}`);
    console.log(`  DB 分配: storeId=${o.assignment ? o.assignment.storeId : 'null'} storeName="${storeName}" status=${o.assignment ? o.assignment.status : 'null'}(${storeStatus})`);
    console.log(`  API 字段: assignment={status:${apiAssignStatus}, storeName:"${apiStoreName}", storeId:"${apiStoreId}"}`);
    console.log(`  ✅ 一致` + (o.assignment ? ` (status=${storeStatus})` : ' (未分配)'));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
