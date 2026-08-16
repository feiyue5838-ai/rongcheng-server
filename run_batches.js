require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { Client } = require('pg');

const BATCH1 = 'C:\\Users\\85428\\.qclaw\\workspace-v733kxt9elzfv7u1\\batch1_orders.sql';
const BATCH2 = 'C:\\Users\\85428\\.qclaw\\workspace-v733kxt9elzfv7u1\\batch2_rest.sql';

async function runSql(client, label, path) {
  const sql = fs.readFileSync(path, 'utf8');
  console.log('\n=== ' + label + ' ===');
  const start = Date.now();
  try {
    await client.query(sql);
    console.log('OK (' + ((Date.now() - start) / 1000).toFixed(2) + 's)');
    return true;
  } catch (err) {
    console.error('FAIL: ' + err.message);
    return false;
  }
}

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: process.env.DB_NAME || 'rongcheng',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'wuhongyuan198911'
  });
  await client.connect();

  // 执行两批
  const ok1 = await runSql(client, '批次1: orders 主表', BATCH1);
  const ok2 = await runSql(client, '批次2: 其余 21 张表', BATCH2);

  // 验证
  const targetTables = [
    'orders',
    'admin_operation_logs','supplier_accounts','order_addresses','order_materials',
    'order_events','seal_order_details','newspaper_order_details','bookkeeping_order_details',
    'fulfillment_assignments','seal_fulfillment_records',
    'supplier_capabilities','supplier_licenses','supplier_metrics',
    'supplier_payouts','invoice_records','logistics_records',
    'notifications','migration_seal_orders_snapshot',
    'business_configs','dispatch_rules'
  ];

  console.log('\n=== 验证 22 张目标表 ===');
  let created = 0;
  for (const t of targetTables) {
    const r = await client.query(
      "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name=$1",
      [t]
    );
    if (r.rows[0].cnt > 0) { console.log('  [OK] ' + t); created++; }
    else { console.log('  [MISS] ' + t); }
  }

  const total = await client.query(
    "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE '_prisma_%'"
  );
  console.log('\n总表数: ' + total.rows[0].cnt + '（新增 ' + (total.rows[0].cnt - 57) + '）');
  console.log('目标表: ' + created + '/' + targetTables.length + ' 已创建');

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
