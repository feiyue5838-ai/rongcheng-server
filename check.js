const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const count = await p.$queryRaw`SELECT COUNT(*)::int as count FROM bookkeeping_packages`;
  console.log("bookkeeping_packages 表: " + count[0].count + " 条数据");
  await p.$disconnect();
})().catch(e => console.error(e.message));
