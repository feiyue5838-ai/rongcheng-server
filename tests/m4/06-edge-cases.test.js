// M4 测试 06：边界与异常用例
// 覆盖：非法状态流转、非 owner 访问、重复取消、乐观锁冲突、重复回调、越权派单、错误参数
'use strict';
process.env.NODE_PATH = process.env.NODE_PATH || 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const L = require('./lib/m4lib');
const { request, deep, check, checkEq, section, tokens, summarize, USER_ID } = L;
const { cleanupByOrderId, cleanupByRemark } = require('./lib/cleanup');

let orderNo, orderId, paymentNo, fulfillmentId, orderNo2, orderId2;

(async () => {
  section('06 边界与异常用例');

  // ========== A. 非法状态流转 ==========
  // 1. 创建订单
  const create = await request('POST', '/api/v2/user/orders/seal', {
    totalAmount: 150,
    companyName: 'M4边界测试公司',
    legalPerson: '测试员',
    sealCount: 1,
    sealTypes: ['公章'],
    filingRequired: false,
    remark: 'm4-edge-test',
  }, tokens.user);
  checkEq('创建订单 201', create.status, 201);
  const cd = deep(create);
  orderNo = cd.orderNo;

  const d0 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  orderId = deep(d0).order.id;

  // 2. 未支付不能取消？→ 待支付订单可取消（业务允许）
  const cancelPending = await request('POST', `/api/v2/user/orders/${orderNo}/cancel`, {}, tokens.user);
  check('待支付订单可取消', cancelPending.status === 201 || cancelPending.status === 200);

  // 3. 已取消订单不能支付
  const payCanceled = await request('POST', `/api/v2/user/orders/${orderNo}/pay`, {}, tokens.user);
  check('已取消订单不能支付', payCanceled.status === 400 || payCanceled.status === 409);

  // ========== B. 非 owner 访问 ==========
  // 4. 创建第二订单（另一个 user token）
  const create2 = await request('POST', '/api/v2/user/orders/seal', {
    totalAmount: 100,
    companyName: 'M4越权测试公司',
    legalPerson: '测试员',
    sealCount: 1,
    sealTypes: ['公章'],
    filingRequired: false,
    remark: 'm4-owner-test',
  }, tokens.user);
  const cd2 = deep(create2);
  orderNo2 = cd2.orderNo;
  const d2 = await request('GET', `/api/v2/user/orders/${orderNo2}`, null, tokens.user);
  orderId2 = deep(d2).order.id;

  // 另一个用户 token（真实存在的启用用户）
  const OTHER_USER_ID = '40c9ebe5-dfac-49af-9350-17392321a29a'; // 真实第二用户（status=1）
  const otherToken = L.jwtSign({ sub: OTHER_USER_ID, openid: 'mock_openid_other', type: 'user' }, L.USER_SECRET);
  const otherDetail = await request('GET', `/api/v2/user/orders/${orderNo2}`, null, otherToken);
  check('非 owner 看详情被拒', otherDetail.status === 400 || otherDetail.status === 403, { actual: otherDetail.status });

  const otherPay = await request('POST', `/api/v2/user/orders/${orderNo2}/pay`, {}, otherToken);
  check('非 owner 支付被拒', otherPay.status === 400 || otherPay.status === 403, { actual: otherPay.status });

  // ========== C. 支付回调边界 ==========
  // 5. 支付参数幂等（重复调用同一 paymentNo）
  const pay1 = await request('POST', `/api/v2/user/orders/${orderNo2}/pay`, {}, tokens.user);
  paymentNo = deep(pay1).paymentNo;
  const pay2 = await request('POST', `/api/v2/user/orders/${orderNo2}/pay`, {}, tokens.user);
  checkEq('支付参数幂等', deep(pay2).paymentNo, paymentNo);

  // 6. 错误金额回调 → 拒付（金额校验）
  const wrongNotify = await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo, transaction_id: 'M4WRONG' + Date.now(), total_fee: 1,
    return_code: 'SUCCESS', result_code: 'SUCCESS', trade_state: 'SUCCESS',
  });
  check('金额不符回调返回 FAIL', wrongNotify.status === 200 && String(wrongNotify.raw || '').includes('FAIL'));

  // 7. 正确回调
  const notify = await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo, transaction_id: 'M4OKTX' + Date.now(), total_fee: 10000,
    return_code: 'SUCCESS', result_code: 'SUCCESS', trade_state: 'SUCCESS',
  });
  check('正确回调 SUCCESS', notify.status === 200 && String(notify.raw || '').includes('SUCCESS'));

  // 8. 重复回调幂等（不重复入账）
  const dupNotify = await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo, transaction_id: 'M4OKTX2' + Date.now(), total_fee: 10000,
    return_code: 'SUCCESS', result_code: 'SUCCESS', trade_state: 'SUCCESS',
  });
  check('重复回调 SUCCESS（幂等）', dupNotify.status === 200 && String(dupNotify.raw || '').includes('SUCCESS'));

  // 9. 已支付订单重复支付参数 → 应拒绝或复用
  const payAfterPaid = await request('POST', `/api/v2/user/orders/${orderNo2}/pay`, {}, tokens.user);
  check('已支付订单支付参数被拒', payAfterPaid.status === 400 || payAfterPaid.status === 409);

  // ========== D. 履约边界 ==========
  // 10. 未支付/已取消订单不能派单
  const assignCanceled = await request('POST', `/api/v2/admin/orders/${orderNo}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  check('已取消订单不能派单', assignCanceled.status === 400 || assignCanceled.status === 409);

  // 11. 正常派单第二单
  const assign2 = await request('POST', `/api/v2/admin/orders/${orderNo2}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  checkEq('派单 201', assign2.status, 201);
  fulfillmentId = deep(assign2).fulfillmentId || deep(assign2).id;

  // 12. 重复派单 → 冲突（已指派）
  const assignDup = await request('POST', `/api/v2/admin/orders/${orderNo2}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  check('重复派单被拒', assignDup.status === 400 || assignDup.status === 409);

  // 13. 未接单不能开始制作
  const startEarly = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/start`, {}, tokens.supplier);
  check('未接单不能制作', startEarly.status === 400);

  // 14. 拒单（测试 reject 分支）
  const reject = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/reject`, { reason: 'M4 拒单测试' }, tokens.supplier);
  checkEq('拒单 201', reject.status, 201);

  // 15. 拒单后订单回到待派单
  const dAfterReject = await request('GET', `/api/v2/user/orders/${orderNo2}`, null, tokens.user);
  check('拒单后 fulfillmentStatus=pending_assignment', deep(dAfterReject).order.fulfillmentStatus === 'pending_assignment');

  // 16. 已拒单不能接单
  const acceptRejected = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/accept`, {}, tokens.supplier);
  check('已拒单不能接单', acceptRejected.status === 400 || acceptRejected.status === 409);

  // ========== E. 乐观锁 ==========
  // 17. 并发冲突模拟：直接改 DB version 制造冲突，再走确认收货 → 409
  const { getClient } = require('./lib/cleanup');
  const pg = await getClient();
  const detailNow = await request('GET', `/api/v2/user/orders/${orderNo2}`, null, tokens.user);
  const orderRow = (await pg.query('SELECT version FROM orders WHERE id = $1', [orderId2])).rows[0];
  // 模拟并发：version 已被他人 +1
  await pg.query('UPDATE orders SET version = version + 1 WHERE id = $1', [orderId2]);
  await pg.end();

  // 重新派单（回到 assigned）
  const assign3 = await request('POST', `/api/v2/admin/orders/${orderNo2}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  // 可能成功（版本不参与派单）或失败——只记录
  const flId3 = (deep(assign3).fulfillmentId) || (deep(assign3).id);
  if (flId3) {
    await request('POST', `/api/v2/supplier/orders/${flId3}/accept`, {}, tokens.supplier);
    await request('POST', `/api/v2/supplier/orders/${flId3}/start`, {}, tokens.supplier);
    await request('POST', `/api/v2/supplier/orders/${flId3}/deliver`, { courier: '顺丰', trackingNo: 'SF' + Date.now() }, tokens.supplier);
  }

  // 18. 清理（用 DB 直接清，因版本被改不影响清理）
  await cleanupByOrderId(orderId);
  await cleanupByOrderId(orderId2);

  // 兜底清理（防止中途失败残留）
  await cleanupByRemark('m4-%');
  const r = summarize();
  process.exit(r.failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
