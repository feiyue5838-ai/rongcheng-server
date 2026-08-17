// M4 测试 05：结算生成/确认/付款 + 退款审核管理端流程
'use strict';
process.env.NODE_PATH = process.env.NODE_PATH || 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const L = require('./lib/m4lib');
const { request, deep, check, checkEq, section, tokens, summarize } = L;
const { cleanupByOrderId, cleanupByRemark } = require('./lib/cleanup');

let orderNo, orderId, paymentNo, fulfillmentId, settlementId, refundId, refundNo;

(async () => {
  section('05 结算 + 退款管理');

  // ========== 结算流程 ==========
  // 1. 创建 + 支付 + 派单 + 接单 + 制作 + 发货 + 确认（形成 completed 订单）
  const create = await request('POST', '/api/v2/user/orders/seal', {
    totalAmount: 200,
    companyName: 'M4结算测试公司',
    legalPerson: '赵六',
    sealCount: 1,
    sealTypes: ['公章'],
    filingRequired: false,
    remark: 'm4-settlement-test',
  }, tokens.user);
  checkEq('创建订单 201', create.status, 201);
  const cd = deep(create);
  orderNo = cd.orderNo;

  const pay = await request('POST', `/api/v2/user/orders/${orderNo}/pay`, {}, tokens.user);
  paymentNo = deep(pay).paymentNo;
  await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo, transaction_id: 'M4SETTX' + Date.now(), total_fee: 20000,
    return_code: 'SUCCESS', result_code: 'SUCCESS', trade_state: 'SUCCESS',
  });

  const d0 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  orderId = deep(d0).order.id;

  const assign = await request('POST', `/api/v2/admin/orders/${orderNo}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  fulfillmentId = deep(assign).fulfillmentId || deep(assign).id;

  await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/accept`, {}, tokens.supplier);
  await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/start`, {}, tokens.supplier);
  await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/deliver`, { courier: '顺丰', trackingNo: 'SF' + Date.now() }, tokens.supplier);
  await request('POST', `/api/v2/user/orders/${orderNo}/confirm`, {}, tokens.user);

  // 2. 生成结算单
  const periodStart = '2026-08-01';
  const periodEnd = '2026-08-31';
  const gen = await request('POST', '/api/v2/admin/settlements/generate', {
    supplierId: L.OUTLET_ID,
    periodStart,
    periodEnd,
  }, tokens.admin);
  checkEq('生成结算单 201', gen.status, 201);
  const gd = deep(gen);
  console.log('   生成结果:', JSON.stringify(gd).slice(0, 200));
  check('生成返回结算单', gd && (gd.id || gd.settlementId || gd.settlementNo));

  // 3. 管理端结算列表
  const list = await request('GET', '/api/v2/admin/settlements', null, tokens.admin);
  const ld = deep(list);
  checkEq('结算列表 200', list.status, 200);
  check('列表含生成的结算单', (ld.list || []).length >= 1);
  const settleRow = (ld.list || []).find(s => s.status === 'pending' || s.status === 'draft');
  settlementId = settleRow ? settleRow.id : (ld.list && ld.list[0] && ld.list[0].id);
  check('拿到 settlementId', typeof settlementId === 'string');

  // 4. 结算详情
  const detail = await request('GET', `/api/v2/admin/settlements/${settlementId}`, null, tokens.admin);
  checkEq('结算详情 200', detail.status, 200);
  const sdd = deep(detail);
  check('详情含 items', Array.isArray(sdd.items) && sdd.items.length >= 1);

  // 5. 确认结算
  const confirm = await request('PUT', `/api/v2/admin/settlements/${settlementId}/confirm`, { remark: 'M4 确认' }, tokens.admin);
  check('确认结算 200/201', confirm.status === 200 || confirm.status === 201, { actual: confirm.status });

  // 6. 付款（生成供应商付款记录）
  const payS = await request('POST', `/api/v2/admin/settlements/${settlementId}/pay`, {}, tokens.admin);
  checkEq('结算付款 201', payS.status, 201);
  const psd = deep(payS);
  check('付款返回 payoutNo', psd && (psd.payoutNo || psd.payout_no));

  // 7. 供应商查看结算
  const supSettles = await request('GET', '/api/v2/supplier/settlements', null, tokens.supplier);
  checkEq('供应商结算列表 200', supSettles.status, 200);
  const ssd = deep(supSettles);
  check('供应商可见结算单', (ssd.list || []).length >= 1);

  // ========== 退款管理流程 ==========
  // 8. 再建一个订单走退款
  const create2 = await request('POST', '/api/v2/user/orders/seal', {
    totalAmount: 150,
    companyName: 'M4退款测试公司',
    legalPerson: '钱七',
    sealCount: 1,
    sealTypes: ['财务章'],
    filingRequired: false,
    remark: 'm4-refund-admin-test',
  }, tokens.user);
  const cd2 = deep(create2);
  const orderNo2 = cd2.orderNo;
  const pay2 = await request('POST', `/api/v2/user/orders/${orderNo2}/pay`, {}, tokens.user);
  const paymentNo2 = deep(pay2).paymentNo;
  await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo2, transaction_id: 'M4RFTX' + Date.now(), total_fee: 15000,
    return_code: 'SUCCESS', result_code: 'SUCCESS', trade_state: 'SUCCESS',
  });
  const d2 = await request('GET', `/api/v2/user/orders/${orderNo2}`, null, tokens.user);
  const orderId2 = deep(d2).order.id;

  // 9. 申请退款
  const apply = await request('POST', `/api/v2/user/orders/${orderNo2}/refund`, { reason: 'M4 退款' }, tokens.user);
  checkEq('申请退款 201', apply.status, 201);
  refundNo = deep(apply).refundNo;

  // 10. 管理端列表（按状态筛选）
  const refunds = await request('GET', '/api/v2/admin/refunds?status=applying', null, tokens.admin);
  const rfd = deep(refunds);
  check('退款列表含新单', (rfd.list || []).some(r => r.orderNo === orderNo2));
  const refundRow = (rfd.list || []).find(r => r.refundNo === refundNo);
  refundId = refundRow && refundRow.id;
  check('列表返回退款 id', typeof refundId === 'string');

  // 11. 驳回测试：先建第二单驳回
  // （当前单走审核通过）驳回验证放到边界测试 06
  const approve = await request('POST', `/api/v2/admin/refunds/${refundId}/approve`, { remark: 'M4 审核通过' }, tokens.admin);
  checkEq('审核通过 201', approve.status, 201);

  // 12. 退款回调
  const rfNotify = await request('POST', '/api/v2/payments/wechat/refund-notify', {
    out_refund_no: refundNo, refund_id: 'M4REF' + Date.now(), refund_status: 'SUCCESS',
    success_time: new Date().toISOString(),
  });
  check('退款回调 SUCCESS', rfNotify.status === 200 && String(rfNotify.raw || '').includes('SUCCESS'));

  // 13. 详情退款状态
  const d3 = await request('GET', `/api/v2/user/orders/${orderNo2}`, null, tokens.user);
  const dd3 = deep(d3);
  check('订单退款状态 full_refund', dd3.order && dd3.order.refundStatus === 'full_refund');

  // 14. 管理端退款列表按状态筛选 completed
  const refundsDone = await request('GET', '/api/v2/admin/refunds?status=completed', null, tokens.admin);
  const rfd2 = deep(refundsDone);
  check('退款列表含 completed 单', (rfd2.list || []).some(r => r.refundNo === refundNo));

  // 15. 清理
  await cleanupByOrderId(orderId);
  await cleanupByOrderId(orderId2);

  // 兜底清理（防止中途失败残留）
  await cleanupByRemark('m4-%');
  const r = summarize();
  process.exit(r.failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
