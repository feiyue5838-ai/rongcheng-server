// 修复 Bug 3 & 4: 版面 list_price 和 enable_sections 数据问题
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBugs() {
  console.log('=== 修复 Bug 3 & 4 ===\n');
  
  // Bug 3: 检查版面数据
  console.log('【Bug 3】版面 list_price 字段');
  const sections = await prisma.newspaper_sections.findMany({
    take: 5,
    include: { newspaper: { select: { name: true } } }
  });
  
  console.log('版面数据示例:');
  sections.forEach(s => {
    console.log(`  ${s.newspaper?.name} - ${s.name}: list_price=${s.list_price}`);
  });
  
  // 检查是否有 list_price 为 null 的
  const nullPriceCount = await prisma.newspaper_sections.count({
    where: { list_price: null }
  });
  console.log(`\nlist_price 为 null 的版面: ${nullPriceCount} 条`);
  
  // Bug 4: enable_sections 状态
  console.log('\n【Bug 4】enable_sections 状态');
  const allNewspapers = await prisma.newspapers.findMany({
    select: { id: true, name: true, enable_sections: true }
  });
  
  const enabledCount = allNewspapers.filter(n => n.enable_sections === 1).length;
  console.log(`启用版面的报纸: ${enabledCount}/${allNewspapers.length}`);
  
  // 修复: 将所有报纸的 enable_sections 设为 1
  if (enabledCount === 0 && allNewspapers.length > 0) {
    console.log('\n开始修复 enable_sections...');
    const result = await prisma.newspapers.updateMany({
      where: { enable_sections: 0 },
      data: { enable_sections: 1 }
    });
    console.log(`✅ 已更新 ${result.count} 家报纸的 enable_sections 为 1`);
  }
  
  // 验证版面 list_price
  if (nullPriceCount > 0) {
    console.log('\n检查种子数据是否正确...');
    // 根据报纸级别设置版面价格
    const sectionsWithNullPrice = await prisma.newspaper_sections.findMany({
      where: { list_price: null },
      include: { newspaper: { select: { level: true } } }
    });
    
    for (const section of sectionsWithNullPrice) {
      let price = 300; // 默认价格
      if (section.newspaper?.level === '国家级') {
        price = section.name.includes('头版') ? 5000 : 2000;
      } else if (section.newspaper?.level === '省级') {
        price = section.name.includes('头版') ? 2000 : 800;
      } else {
        price = section.name.includes('头版') ? 800 : 300;
      }
      
      await prisma.newspaper_sections.update({
        where: { id: section.id },
        data: { list_price: price }
      });
    }
    console.log(`✅ 已更新 ${sectionsWithNullPrice.length} 个版面的 list_price`);
  }
  
  await prisma.$disconnect();
  console.log('\n=== 修复完成 ===');
}

fixBugs().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
