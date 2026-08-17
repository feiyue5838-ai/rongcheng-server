// M4 测试套件公共工具库
// 用法：require 本文件前先设置 process.env.NODE_PATH 指向 server/node_modules（若从 workspace 运行）
'use strict';
const http = require('http');
const crypto = require('crypto');
const path = require('path');

const BASE = process.env.M4_BASE || 'http://localhost:3001';
const USER_SECRET = process.env.M4_USER_SECRET || 'rongcheng-jwt-secret-2024-user-only-min32chars-here';
const ADMIN_SECRET = process.env.M4_ADMIN_SECRET || 'rongcheng-jwt-secret-2024-admin-only-min32chars-here';
const OUTLET_SECRET = process.env.M4_OUTLET_SECRET || 'rongcheng-jwt-secret-2024-outlet-min32chars-here';

// 测试身份（与既有测试一致）
const USER_ID = process.env.M4_USER_ID || '05774ae5-d3ed-411e-9720-d843675d69c3';
const ADMIN_ID = process.env.M4_ADMIN_ID || 'f6fbda6f-27ed-4af7-95a5-569541a852cb';
// 供应商（蓉城刻章天府广场店）
const OUTLET_ID = process.env.M4_OUTLET_ID || 'f291f92e-c092-4725-b1b1-b4c397015f63';

function jwtSign(payload, secret) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

const tokens = {
  user: jwtSign({ sub: USER_ID, openid: 'mock_openid_m4', type: 'user' }, USER_SECRET),
  admin: jwtSign({ sub: ADMIN_ID, type: 'admin' }, ADMIN_SECRET),
  supplier: jwtSign({ sub: OUTLET_ID, type: 'Outlet' }, OUTLET_SECRET),
};

function request(method, path, body, token, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(BASE + path);
    const r = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: timeoutMs,
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (e) { /* raw */ }
        resolve({ status: res.statusCode, body: parsed, raw: buf, headers: res.headers });
      });
    });
    r.on('timeout', () => { r.destroy(); reject(new Error(`timeout ${method} ${path}`)); });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// 深度解包（处理 ResponseInterceptor 双层/三层包装）
function deep(res) {
  let d = res.body;
  let guard = 0;
  while (d && typeof d === 'object' && d.data !== undefined && guard++ < 6) {
    d = d.data;
  }
  return d;
}

// 断言工具
let passed = 0, failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else {
    failed++;
    const msg = `  ❌ ${name}${detail ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`;
    failures.push(msg);
    console.log(msg);
  }
}
function checkEq(name, actual, expected) {
  check(name, actual === expected, { actual, expected });
}
function section(title) {
  console.log(`\n== ${title} ==`);
}

// 状态/模块展示
const MODULE_TEXT = { seal: '刻章', newspaper: '登报', bookkeeping: '记账' };

function summarize() {
  console.log(`\n===== 汇总: 通过 ${passed} / 失败 ${failed} =====`);
  if (failures.length) {
    console.log('失败明细:');
    failures.forEach(f => console.log(f));
  }
  return { passed, failed, failures };
}

module.exports = {
  BASE, USER_SECRET, ADMIN_SECRET, OUTLET_SECRET,
  USER_ID, ADMIN_ID, OUTLET_ID,
  tokens, jwtSign, request, deep, check, checkEq, section, summarize,
  MODULE_TEXT,
};
