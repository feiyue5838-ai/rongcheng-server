const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const storeId = '52a5fe98-b213-4dab-bac0-043795445ee0'; // 龙泉驿店
  const newPassword = 'store123';
  const hashed = await bcrypt.hash(newPassword, 10);
  
  await prisma.store.update({
    where: { id: storeId },
    data: { password: hashed }
  });
  
  console.log('Password reset to: store123');
  await prisma.$disconnect();
}

main().catch(console.error);
