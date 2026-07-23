const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const packages = [
    // 小规模
    { name: '小规模企业-全年代理记账', taxpayerType: 'small', cycle: 'year', basePrice: 1999, invoicePrice: 200, socialPrice: 300, fundPrice: 300 },
    { name: '小规模企业-半年代理记账', taxpayerType: 'small', cycle: 'half', basePrice: 1199, invoicePrice: 200, socialPrice: 300, fundPrice: 300 },
    // 一般纳税人
    { name: '一般纳税人企业-全年代理记账', taxpayerType: 'general', cycle: 'year', basePrice: 3999, invoicePrice: 500, socialPrice: 300, fundPrice: 300 },
    { name: '一般纳税人企业-半年代理记账', taxpayerType: 'general', cycle: 'half', basePrice: 2299, invoicePrice: 500, socialPrice: 300, fundPrice: 300 },
    // 预订
    { name: '代理记账预订服务', taxpayerType: 'general', cycle: 'preorder', basePrice: 9.9, invoicePrice: 0, socialPrice: 0, fundPrice: 0 },
  ];
  for (const pkg of packages) {
    await p.$executeRawUnsafe(`
      INSERT INTO bookkeeping_packages (id, name, taxpayer_type, cycle, base_price, invoice_price, social_price, fund_price, status, created_at, updated_at)
      VALUES (gen_random_uuid(), '${pkg.name}', '${pkg.taxpayerType}', '${pkg.cycle}', ${pkg.basePrice}, ${pkg.invoicePrice}, ${pkg.socialPrice}, ${pkg.fundPrice}, 1, NOW(), NOW())
      ON CONFLICT (taxpayer_type, cycle) DO UPDATE SET
        name = EXCLUDED.name,
        base_price = EXCLUDED.base_price,
        invoice_price = EXCLUDED.invoice_price,
        social_price = EXCLUDED.social_price,
        fund_price = EXCLUDED.fund_price,
        updated_at = NOW()
    `);
  }
  console.log('OK: ' + packages.length + ' packages inserted');
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
