require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: process.env.DB_NAME || 'rongcheng',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'wuhongyuan198911'
  });
  await client.connect();

  // 所有现有表
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE '_prisma_%' ORDER BY table_name"
  );
  const existing = new Set(tables.rows.map(r => r.table_name));

  // V2.0 需要的所有表
  const v2Tables = [
    'business_configs',
    'dispatch_rules',
    'content_about',
    'seal_packages',
    'newspapers',
    'newspaper_templates',
    'bookkeeping_packages',
    'admin_operation_logs',
    'users',
    'admins',
    'suppliers',
    'supplier_accounts',
    'orders',
    'order_items',
    'order_addresses',
    'order_materials',
    'order_events',
    'seal_order_details',
    'newspaper_order_details',
    'bookkeeping_order_details',
    'payment_orders',
    'payment_transactions',
    'refund_orders',
    'fulfillment_orders',
    'fulfillment_assignments',
    'seal_fulfillment_records',
    'supplier_capabilities',
    'supplier_licenses',
    'supplier_metrics',
    'settlement_records',
    'settlement_items',
    'supplier_payouts',
    'invoice_records',
    'logistics_records',
    'notifications',
    'migration_seal_orders_snapshot'
  ];

  console.log('=== V2.0 表对比 ===\n');
  
  const missing = [];
  const exists = [];
  
  for (const t of v2Tables) {
    if (existing.has(t)) {
      exists.push(t);
      console.log('  [OK] ' + t);
    } else {
      missing.push(t);
      console.log('  [MISSING] ' + t);
    }
  }

  // 检查旧 V1.0 表
  const v1Tables = ['seal_orders', 'newspapers', 'outlets', 'order_items_new', 'order_seal_details', 'order_newspaper_details', 'order_bookkeeping_details'];
  console.log('\n=== V1.0 历史表（需迁移/废弃）===\n');
  for (const t of v1Tables) {
    if (existing.has(t)) {
      const count = await client.query(`SELECT count(*)::int as cnt FROM "${t}"`);
      console.log('  [OLD] ' + t + ' (' + count.rows[0].cnt + ' rows)');
    }
  }

  console.log('\n=== 总结 ===');
  console.log('V2.0 表: ' + exists.length + '/' + v2Tables.length + ' 已存在');
  console.log('需新建: ' + missing.length + ' 张表');
  if (missing.length > 0) {
    console.log('缺失表: ' + missing.join(', '));
  }

  await client.end();
}

main().catch(console.error);
