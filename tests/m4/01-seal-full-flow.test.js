// M4 测试 01：刻章订单全流程端到端
// 覆盖：创建 → 支付参数(幂等) → 微信回调(幂等) → 派单 → 接单 → 制作 → 发货 → 确认收货 → 退款申请/审核 → 订单详情五维状态
'use strict';
process.env.NODE_PATH = process.env.NODE_PATH || 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const L = require('./lib/m4lib');
const { request, deep, check, checkEq, section, tokens, summarize } = L;

let orderNo, orderId, paymentNo, fulfillmentId, refundId;

(async () => {
  section('01 刻章订单全流程');

  // 1. 创建刻章订单
  const create = await request('POST', '/api/v2/user/orders/seal', {
    totalAmount: 150,
    companyName: 'M4测试科技公司',
    legalPerson: '测试员',
    sealCount: 2,
    sealTypes: ['公章', '财务章'],
    filingRequired: true,
    remark: 'm4-seal-flow-test',
  }, tokens.user);
  checkEq('创建订单 201', create.status, 201);
  const cd = deep(create);
  orderNo = cd.orderNo;
  check('创建返回 orderNo', typeof orderNo === 'string' && orderNo.startsWith('SE'));
  console.log('   orderNo:', orderNo);

  // 2. 支付参数
  const pay1 = await request('POST', `/api/v2/user/orders/${orderNo}/pay`, {}, tokens.user);
  checkEq('支付参数 201', pay1.status, 201);
  const pd1 = deep(pay1);
  paymentNo = pd1.paymentNo;
  check('返回 paymentNo', typeof paymentNo === 'string' && paymentNo.startsWith('PAY'));

  // 3. 支付参数幂等（重复调用同一 paymentNo）
  const pay2 = await request('POST', `/api/v2/user/orders/${orderNo}/pay`, {}, tokens.user);
  const pd2 = deep(pay2);
  checkEq('支付参数幂等复用', pd2.paymentNo, paymentNo);

  // 4. 微信回调（V2 格式）
  const notify = await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo,
    transaction_id: 'M4TX' + Date.now(),
    total_fee: 15000,
    return_code: 'SUCCESS',
    result_code: 'SUCCESS',
    trade_state: 'SUCCESS',
  });
  checkEq('回调 200', notify.status, 200);
  const notifyText = notify.raw || (notify.body && notify.body.message);
  check('回调返回 SUCCESS', String(notifyText).includes('SUCCESS'));

  // 5. 回调幂等（重复回调不重复入账）
  const notify2 = await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo,
    transaction_id: 'M4TX' + Date.now(),
    total_fee: 15000,
    return_code: 'SUCCESS',
    result_code: 'SUCCESS',
    trade_state: 'SUCCESS',
  });
  checkEq('重复回调 200', notify2.status, 200);
  check('重复回调 SUCCESS', String(notify2.raw || '').includes('SUCCESS'));

  // 6. 订单详情（五维状态）
  const detail1 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  const dd1 = deep(detail1);
  checkEq('详情 200', detail1.status, 200);
  check('订单已支付 paymentStatus=paid', dd1.order && dd1.order.paymentStatus === 'paid');
  check('订单 orderStatus=paid', dd1.order && dd1.order.orderStatus === 'paid');
  check('事件含 PAYMENT_SUCCESS', (dd1.events || []).some(e => e.eventType === 'PAYMENT_SUCCESS'));
  orderId = dd1.order && dd1.order.id;

  // 7. 管理端待派单列表
  const unassigned = await request('GET', '/api/v2/admin/orders/unassigned', null, tokens.admin);
  const ud = deep(unassigned);
  check('待派单列表 200', unassigned.status === 200 && Array.isArray(ud.list));

  // 8. 派单
  const assign = await request('POST', `/api/v2/admin/orders/${orderNo}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  checkEq('派单 201', assign.status, 201);
  const ad = deep(assign);
  fulfillmentId = ad.fulfillmentId || (ad.id);
  check('派单返回 fulfillmentId', typeof fulfillmentId === 'string');

  // 9. 供应商接单
  const accept = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/accept`, {}, tokens.supplier);
  checkEq('接单 201', accept.status, 201);

  // 10. 开始制作
  const start = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/start`, {}, tokens.supplier);
  checkEq('制作 201', start.status, 201);

  // 11. 发货
  const deliver = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/deliver`, { courier: '顺丰速运', trackingNo: 'SF' + Date.now() }, tokens.supplier);
  checkEq('发货 201', deliver.status, 201);

  // 12. 供应商订单列表（已完成）
  const supList = await request('GET', '/api/v2/supplier/orders?status=completed', null, tokens.supplier);
  const sd = deep(supList);
  check('供应商已完成列表含订单', supList.status === 200 && (sd.list || []).some(o => o.orderNo === orderNo));

  // 13. 用户确认收货
  const confirm = await request('POST', `/api/v2/user/orders/${orderNo}/confirm`, {}, tokens.user);
  checkEq('确认收货 201', confirm.status, 201);

  // 14. 详情最终状态
  const detail2 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  const dd2 = deep(detail2);
  check('履约完成 fulfillmentStatus=completed', dd2.order && dd2.order.fulfillmentStatus === 'completed');
  check('时间线含履约记录', Array.isArray(dd2.fulfillments) && dd2.fulfillments.length >= 1);

  // 15. 申请退款
  const apply = await request('POST', `/api/v2/user/orders/${orderNo}/refund`, { reason: 'M4 测试退款' }, tokens.user);
  checkEq('申请退款 201', apply.status, 201);
  const apd = deep(apply);
  const refundNo = apd && apd.refundNo;
  check('返回 refundNo', typeof refundNo === 'string' && refundNo.startsWith('RF'));

  // 16. 管理端退款列表（camelCase），匹配 refundNo 拿 id
  const refunds = await request('GET', '/api/v2/admin/refunds?status=applying', null, tokens.admin);
  const rfd = deep(refunds);
  check('退款列表含本单', (rfd.list || []).some(r => r.orderNo === orderNo));
  check('退款字段 camelCase', (rfd.list || []).some(r => r.refundNo && r.refundNo.startsWith('RF')));
  const refundRow = (rfd.list || []).find(r => r.refundNo === refundNo);
  refundId = refundRow && refundRow.id;
  check('列表返回退款 id', typeof refundId === 'string');

  // 17. 审核通过
  const approve = await request('POST', `/api/v2/admin/refunds/${refundId}/approve`, { remark: 'M4 审核' }, tokens.admin);
  checkEq('审核通过 201', approve.status, 201);

  // 18. 微信退款回调（V2 格式：out_refund_no 必须用审核中的退款单号 + refund_status）
  const refundNotify = await request('POST', '/api/v2/payments/wechat/refund-notify', {
    out_refund_no: refundNo,
    refund_id: 'M4REF' + Date.now(),
    refund_status: 'SUCCESS',
    success_time: new Date().toISOString(),
  });
  checkEq('退款回调 200', refundNotify.status, 200);

  // 19. 详情退款状态
  const detail3 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  const dd3 = deep(detail3);
  check('退款状态 refundStatus=full_refund', dd3.order && dd3.order.refundStatus === 'full_refund');
  check('支付状态 paymentStatus=full_refund', dd3.order && dd3.order.paymentStatus === 'full_refund');

  // 20. 清理
  const { cleanupByOrderId, cleanupByRemark } = require('./lib/cleanup');
  await cleanupByOrderId(orderId);

  // 兜底清理（防止中途失败残留）
  await cleanupByRemark('m4-%');
  const r = summarize();
  process.exit(r.failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
