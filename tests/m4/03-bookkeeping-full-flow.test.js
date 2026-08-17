// M4 测试 03：记账订单全流程端到端
// 覆盖：创建（taxpayerType=small_scale）→ 支付 → 派单 → 接单 → 制作 → 发货 → 确认收货 → 详情明细
'use strict';
process.env.NODE_PATH = process.env.NODE_PATH || 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const L = require('./lib/m4lib');
const { request, deep, check, checkEq, section, tokens, summarize } = L;
const { cleanupByOrderId, cleanupByRemark } = require('./lib/cleanup');

let orderNo, orderId, paymentNo, fulfillmentId;

(async () => {
  section('03 记账订单全流程');

  // 1. 创建记账订单
  const create = await request('POST', '/api/v2/user/orders/bookkeeping', {
    totalAmount: 100,
    packageId: '',
    packageName: '小规模代账',
    taxpayerType: 'small_scale',
    servicePeriod: 'year',
    startDate: '2026-08-01',
    endDate: '2027-07-31',
    companyName: 'M4记账测试公司',
    businessLicenseNo: '91510100M4TEST01',
    taxAuthority: '锦江区税务局',
    accountingScope: '全盘账务',
    currentPeriod: 1,
    remark: 'm4-bookkeeping-flow-test',
  }, tokens.user);
  checkEq('创建记账订单 201', create.status, 201);
  const cd = deep(create);
  orderNo = cd.orderNo;
  check('返回 orderNo BK 前缀', typeof orderNo === 'string' && orderNo.startsWith('BK'));
  console.log('   orderNo:', orderNo);

  // 2. 支付参数
  const pay = await request('POST', `/api/v2/user/orders/${orderNo}/pay`, {}, tokens.user);
  checkEq('支付参数 201', pay.status, 201);
  const pd = deep(pay);
  paymentNo = pd.paymentNo;

  // 3. 微信回调
  const notify = await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo,
    transaction_id: 'M4BKTX' + Date.now(),
    total_fee: 10000,
    return_code: 'SUCCESS',
    result_code: 'SUCCESS',
    trade_state: 'SUCCESS',
  });
  check('回调 SUCCESS', notify.status === 200 && String(notify.raw || '').includes('SUCCESS'));

  // 4. 详情（记账明细）
  const detail1 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  const dd1 = deep(detail1);
  checkEq('详情 200', detail1.status, 200);
  check('支付状态 paid', dd1.order && dd1.order.paymentStatus === 'paid');
  check('记账明细存在', dd1.bookkeepingDetails && dd1.bookkeepingDetails.packageName === '小规模代账');
  check('taxpayerType=small_scale', dd1.bookkeepingDetails && dd1.bookkeepingDetails.taxpayerType === 'small_scale');
  orderId = dd1.order && dd1.order.id;

  // 5. 派单
  const assign = await request('POST', `/api/v2/admin/orders/${orderNo}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  checkEq('派单 201', assign.status, 201);
  const ad = deep(assign);
  fulfillmentId = ad.fulfillmentId || ad.id;

  // 6. 接单/制作/发货
  await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/accept`, {}, tokens.supplier);
  await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/start`, {}, tokens.supplier);
  const deliver = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/deliver`, { courier: 'EMS', trackingNo: 'EMS' + Date.now() }, tokens.supplier);
  checkEq('发货 201', deliver.status, 201);

  // 7. 确认收货
  const confirm = await request('POST', `/api/v2/user/orders/${orderNo}/confirm`, {}, tokens.user);
  checkEq('确认收货 201', confirm.status, 201);

  // 8. 最终状态
  const detail2 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  const dd2 = deep(detail2);
  check('履约完成 completed', dd2.order && dd2.order.fulfillmentStatus === 'completed');
  check('订单完成 completed', dd2.order && dd2.order.orderStatus === 'completed');

  // 9. 清理
  await cleanupByOrderId(orderId);

  // 兜底清理（防止中途失败残留）
  await cleanupByRemark('m4-%');
  const r = summarize();
  process.exit(r.failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
