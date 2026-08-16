require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
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

  const sql = fs.readFileSync('C:\\Users\\85428\\.qclaw\\workspace-v733kxt9elzfv7u1\\database_v2_missing_only.sql', 'utf8');
  
  console.log('执行 V2.0 补充建表 SQL...');
  const start = Date.now();
  
  try {
    await client.query(sql);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log('SQL 执行成功，耗时: ' + elapsed + 's');
  } catch (err) {
    console.error('SQL 执行失败:');
    console.error(err.message);
    // 不中断，检查已创建的表
  }

  // 验证新建的表
  const v2Tables = [
    'business_configs', 'dispatch_rules', 'admin_operation_logs',
    'supplier_accounts', 'order_addresses', 'order_materials', 'order_events',
    'seal_order_details', 'newspaper_order_details', 'bookkeeping_order_details',
    'fulfillment_assignments', 'seal_fulfillment_records',
    'supplier_capabilities', 'supplier_licenses', 'supplier_metrics',
    'supplier_payouts', 'invoice_records', 'logistics_records',
    'notifications', 'migration_seal_orders_snapshot'
  ];

  console.log('\n=== 验证新建的表 ===');
  let created = 0;
  for (const t of v2Tables) {
    const r = await client.query(
      "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name=$1",
      [t]
    );
    if (r.rows[0].cnt > 0) {
      console.log('  [OK] ' + t);
      created++;
    } else {
      console.log('  [FAIL] ' + t + ' 未创建');
    }
  }

  // 总表数
  const total = await client.query(
    "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE '_prisma_%'"
  );
  console.log('\n总表数: ' + total.rows[0].cnt + '（之前 57，新增 ' + (total.rows[0].cnt - 57) + '）');
  console.log('新建表: ' + created + '/' + v2Tables.length);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
