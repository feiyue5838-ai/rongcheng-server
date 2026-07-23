const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const tmpl = await p.newspaperTemplate.findUnique({
    where: { id: '2a516a9b-3a5a-4a6e-b4cd-bc0b8f8cc03d' },
    select: { name: true, content: true, status: true }
  });
  if (!tmpl) {
    console.log('模板不存在');
  } else {
    console.log('name:', tmpl.name);
    console.log('status:', tmpl.status);
    console.log('content length:', tmpl.content.length);
    // 检查前300字符
    console.log('content preview:\n', tmpl.content.substring(0, 300));
  }
  await p.$disconnect();
})();
