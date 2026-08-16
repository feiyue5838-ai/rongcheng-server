require('dotenv').config({ path: 'D:/rongcheng-admin/server/.env' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function findUser() {
  const users = await p.users.findMany({ take: 1 });
  console.log('真实用户ID:', users[0]?.id);
  await p.$disconnect();
}

findUser();
