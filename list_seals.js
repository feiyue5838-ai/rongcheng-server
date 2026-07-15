const { PrismaClient } = require('.prisma/client');
const p = new PrismaClient();
p.seal.findMany({ select: { id: true, name: true } }).then(s => {
  console.log(JSON.stringify(s, null, 2));
  p.$disconnect();
});
