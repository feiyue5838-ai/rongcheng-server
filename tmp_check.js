const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const result = await p.$queryRawUnsafe('SELECT COUNT(*) as count FROM bookkeeping_packages');
  console.log('Packages count:', result[0].count);
  const rows = await p.$queryRawUnsafe('SELECT id, name, taxpayer_type, cycle, base_price FROM bookkeeping_packages');
  rows.forEach(r => console.log(JSON.stringify(r)));
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
