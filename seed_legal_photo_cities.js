require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const value = JSON.stringify(['上海', '山东', '新疆', '贵阳']);
  await prisma.systemConfig.upsert({
    where: { key: 'legalPhotoCities' },
    create: {
      key: 'legalPhotoCities',
      value,
      type: 'json',
      group: 'seal',
      name: '法人白底自拍照所需地区',
      description: '企业/个体户刻章时，这些地区的法人需上传白底自拍照。地区名需与小程序 region 字段匹配（region 为“省 市 区”空格连接，如填 上海/山东/新疆/贵阳 即可命中）。留空数组则所有地区都不显示该模块。',
      sort: 11,
    },
    update: {
      value,
    },
  });
  console.log('OK: legalPhotoCities seeded ->', value);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
