const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const count = await p.review.count();
  console.log('评价总数: ' + count);
  if (count > 0) {
    const r = await p.review.findFirst({ 
      orderBy: { createdAt: 'desc' }, 
      include: { user: { select: { nickname: true } } } 
    });
    console.log('最新ID: ' + r.id);
    console.log('状态: ' + r.status);
    console.log('内容: ' + (r.content ? r.content.substring(0, 40) : '空'));
    console.log('用户: ' + (r.user?.nickname || '匿名'));
  } else {
    console.log('数据库没有评价数据，空值是原因');
  const qc = await p.question.count();
  console.log('问答数: ' + qc);
  }
  await p.$disconnect();
})();
