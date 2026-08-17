// M4 测试 07：性能测试 — 200 并发创建订单 / P99 < 500ms
'use strict';
process.env.NODE_PATH = process.env.NODE_PATH || 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const L = require('./lib/m4lib');
const { section, tokens } = L;
const { getClient, cleanupByOrderId, cleanupByRemark } = require('./lib/cleanup');

const CONCURRENCY = 200;

async function timedRequest(method, path, body, token) {
  const t0 = Date.now();
  const res = await L.request(method, path, body, token);
  return { ms: Date.now() - t0, status: res.status };
}

(async () => {
  section(`07 性能测试：${CONCURRENCY} 并发创建刻章订单`);

  // 预热 1 次（编译/连接池）
  await timedRequest('POST', '/api/v2/user/orders/seal', {
    totalAmount: 100, companyName: '预热公司', legalPerson: '预热', sealCount: 1,
    sealTypes: ['公章'], filingRequired: false, remark: 'm4-perf-warmup',
  }, tokens.user);

  // 并发创建 200 个订单
  const tasks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    tasks.push(timedRequest('POST', '/api/v2/user/orders/seal', {
      totalAmount: 100,
      companyName: `M4性能测试公司${i}`,
      legalPerson: '测试员',
      sealCount: 1,
      sealTypes: ['公章'],
      filingRequired: false,
      remark: 'm4-perf-test',
    }, tokens.user));
  }
  const results = await Promise.all(tasks);
  const times = results.map(r => r.ms).sort((a, b) => a - b);
  const statuses = results.map(r => r.status);
  const okCount = statuses.filter(s => s === 201).length;
  const failCount = statuses.length - okCount;

  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const max = times[times.length - 1];

  console.log(`   成功: ${okCount}/${CONCURRENCY}  失败: ${failCount}`);
  console.log(`   平均: ${avg.toFixed(1)}ms  P50: ${p50}ms  P95: ${p95}ms  P99: ${p99}ms  MAX: ${max}ms`);

  L.check('200 并发全部成功', okCount === CONCURRENCY, { ok: okCount, fail: failCount });
  L.check('P99 < 500ms', p99 < 500, { p99 });
  L.check('成功率 ≥ 99.5%', okCount / CONCURRENCY >= 0.995, { rate: (okCount / CONCURRENCY).toFixed(3) });

  // 清理：批量删 m4-perf-test 订单
  const pg = await getClient();
  const r = await pg.query("SELECT id, order_no FROM orders WHERE customer_remark = 'm4-perf-test'");
  console.log(`   清理性能测试订单: ${r.rows.length} 条`);
  for (const row of r.rows) {
    await cleanupByOrderId(row.id);
  }
  await pg.end();
  // 兑底清理 warmup 等其他 m4- 残留
  const n2 = await cleanupByRemark('m4-%');
  if (n2 > 0) console.log(`   兑底清理: ${n2} 条`);
  const { getBaseline } = require('./lib/cleanup');
  console.log(`   orders 基线: ${await getBaseline()}`);

  const res = L.summarize();
  process.exit(res.failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
