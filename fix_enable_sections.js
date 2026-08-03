// 检查并修复 enable_sections
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('=== 检查 enable_sections ===\n');
  
  const allNewspapers = await prisma.newspapers.findMany({
    select: { id: true, name: true, enable_sections: true }
  });
  
  const enabledCount = allNewspapers.filter(n => n.enable_sections === 1).length;
  console.log(`启用版面的报纸: ${enabledCount}/${allNewspapers.length}`);
  
  if (enabledCount === 0 && allNewspapers.length > 0) {
    console.log('\n开始修复 enable_sections...');
    const result = await prisma.newspapers.updateMany({
      data: { enable_sections: 1 }
    });
    console.log(`✅ 已更新 ${result.count} 家报纸的 enable_sections 为 1`);
  } else {
    console.log('✅ enable_sections 已正确设置');
  }
  
  await prisma.$disconnect();
}

fix().catch(console.error);
