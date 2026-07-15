const { PrismaClient } = require('@prisma/client');

// Force same connection string as server
process.env.DATABASE_URL = 'postgresql://postgres:wuhongyuan198911@localhost:5432/rongcheng?schema=public&client_encoding=UTF8';

const p = new PrismaClient();
const userId = '353d7e83-24db-4f77-991d-5c705f372ddf';

p.$connect().then(() => {
  console.log('Connected to DB');
  return p.user.findUnique({ where: { id: userId } });
}).then(user => {
  console.log('User from DB:', user ? { id: user.id, status: user.status } : 'NOT FOUND');
  p.$disconnect().then(() => process.exit(0));
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
