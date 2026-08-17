// M4 测试 02：登报订单全流程端到端
// 覆盖：创建（含地址快照）→ 支付 → 派单 → 接单 → 制作 → 发货 → 确认收货 → 详情明细
'use strict';
process.env.NODE_PATH = process.env.NODE_PATH || 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const L = require('./lib/m4lib');
const { request, deep, check, checkEq, section, tokens, summarize } = L;
const { cleanupByOrderId, cleanupByRemark } = require('./lib/cleanup');

let orderNo, orderId, paymentNo, fulfillmentId;

(async () => {
  section('02 登报订单全流程');

  // 1. 创建登报订单（含地址快照）
  const create = await request('POST', '/api/v2/user/orders/newspaper', {
    totalAmount: 26,
    newspaperId: '5b76239e-2df0-4b63-9986-2927013afea8',
    newspaperName: '测试报纸',
    templateType: 'statement',
    content: 'M4登报测试声明内容',
    contentCharCount: 10,
    copies: 1,
    publicationDate: '2026-08-20',
    remark: 'm4-newspaper-flow-test',
    addressSnapshot: {
      receiverName: '张三',
      receiverPhone: '13800000000',
      province: '四川省',
      city: '成都市',
      district: '锦江区',
      address: '测试路 1 号',
    },
  }, tokens.user);
  checkEq('创建登报订单 201', create.status, 201);
  const cd = deep(create);
  orderNo = cd.orderNo;
  check('返回 orderNo NP 前缀', typeof orderNo === 'string' && orderNo.startsWith('NP'));
  console.log('   orderNo:', orderNo);

  // 2. 支付参数
  const pay = await request('POST', `/api/v2/user/orders/${orderNo}/pay`, {}, tokens.user);
  checkEq('支付参数 201', pay.status, 201);
  const pd = deep(pay);
  paymentNo = pd.paymentNo;

  // 3. 微信回调
  const notify = await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo,
    transaction_id: 'M4NPTX' + Date.now(),
    total_fee: 2600,
    return_code: 'SUCCESS',
    result_code: 'SUCCESS',
    trade_state: 'SUCCESS',
  });
  check('回调 SUCCESS', notify.status === 200 && String(notify.raw || '').includes('SUCCESS'));

  // 4. 详情（登报明细 + 地址快照）
  const detail1 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  const dd1 = deep(detail1);
  checkEq('详情 200', detail1.status, 200);
  check('支付状态 paid', dd1.order && dd1.order.paymentStatus === 'paid');
  check('地址快照落库', dd1.order && dd1.order.addressSnapshot && dd1.order.addressSnapshot.receiverName === '张三');
  check('登报明细存在', dd1.newspaperDetails && dd1.newspaperDetails.content === 'M4登报测试声明内容');
  orderId = dd1.order && dd1.order.id;

  // 5. 派单
  const assign = await request('POST', `/api/v2/admin/orders/${orderNo}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  checkEq('派单 201', assign.status, 201);
  const ad = deep(assign);
  fulfillmentId = ad.fulfillmentId || ad.id;

  // 6. 接单/制作/发货
  await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/accept`, {}, tokens.supplier);
  await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/start`, {}, tokens.supplier);
  const deliver = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/deliver`, { courier: '中通快递', trackingNo: 'ZT' + Date.now() }, tokens.supplier);
  checkEq('发货 201', deliver.status, 201);

  // 7. 发货后订单履约状态 delivering
  const detail2 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  const dd2 = deep(detail2);
  check('发货后 fulfillmentStatus=delivering', dd2.order && dd2.order.fulfillmentStatus === 'delivering');

  // 8. 确认收货
  const confirm = await request('POST', `/api/v2/user/orders/${orderNo}/confirm`, {}, tokens.user);
  checkEq('确认收货 201', confirm.status, 201);

  // 9. 最终状态
  const detail3 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  const dd3 = deep(detail3);
  check('履约完成 completed', dd3.order && dd3.order.fulfillmentStatus === 'completed');
  check('订单完成 completed', dd3.order && dd3.order.orderStatus === 'completed');

  // 10. 清理
  await cleanupByOrderId(orderId);

  // 兜底清理（防止中途失败残留）
  await cleanupByRemark('m4-%');
  const r = summarize();
  process.exit(r.failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
