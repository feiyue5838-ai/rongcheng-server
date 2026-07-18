const dotenv = require('dotenv');
dotenv.config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const value = JSON.stringify(['上海', '山东', '新疆', '贵阳']);
  await prisma.systemConfig.upsert({
    where: { key: 'handheldIdCities' },
    create: {
      key: 'handheldIdCities',
      value,
      type: 'json',
      group: 'seal',
      name: '法人手持身份证所需地区',
      description: '企业刻章时，这些地区的法人需上传手持身份证拍照。地区名需与小程序 region 字段匹配（region 为“省 市 区”空格连接，如填 上海/山东/新疆/贵阳 即可命中）',
      sort: 10,
    },
    update: {
      value,
    },
  });
  console.log('OK: handheldIdCities seeded ->', value);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
