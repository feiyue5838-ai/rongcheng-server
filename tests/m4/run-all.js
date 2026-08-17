// M4 测试套件一键运行器：顺序执行全部测试 + 汇总报告
'use strict';
process.env.NODE_PATH = process.env.NODE_PATH || 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TESTS = [
  '01-seal-full-flow.test.js',
  '02-newspaper-full-flow.test.js',
  '03-bookkeeping-full-flow.test.js',
  '04-supplier-flow.test.js',
  '05-settlement-refund.test.js',
  '06-edge-cases.test.js',
  '07-perf.test.js',
];

const results = [];
for (const t of TESTS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`运行: ${t}`);
  console.log('='.repeat(60));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, t)], {
    encoding: 'utf8',
    timeout: 600000,
    env: { ...process.env },
  });
  const ms = Date.now() - t0;
  const ok = r.status === 0;
  console.log(r.stdout);
  if (r.stderr) console.error('STDERR:', r.stderr.slice(0, 2000));
  results.push({ name: t, ok, status: r.status, ms, signal: r.signal });
}

console.log(`\n${'='.repeat(60)}`);
console.log('M4 测试套件汇总');
console.log('='.repeat(60));
let pass = 0;
for (const r of results) {
  const mark = r.ok ? '✅' : '❌';
  console.log(`${mark} ${r.name}  (${r.ms}ms, exit=${r.status})`);
  if (r.ok) pass++;
}
console.log(`\n通过: ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
