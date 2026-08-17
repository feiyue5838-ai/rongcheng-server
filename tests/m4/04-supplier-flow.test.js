// M4 测试 04：供应商端全链路（派单 → 接单 → 拒单 → 制作 → 回执上传 → 发货 → 结算查看）
'use strict';
process.env.NODE_PATH = process.env.NODE_PATH || 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const L = require('./lib/m4lib');
const { request, deep, check, checkEq, section, tokens, summarize } = L;
const { cleanupByOrderId, cleanupByRemark } = require('./lib/cleanup');
const fs = require('fs');
const path = require('path');

let orderNo, orderId, paymentNo, fulfillmentId, flNo;

// 供应商列表（含可用供应商）
function supplierToken(id) {
  return L.jwtSign({ sub: id, type: 'Outlet' }, L.OUTLET_SECRET);
}

(async () => {
  section('04 供应商端全链路');

  // 0. 管理端供应商列表
  const suppliers = await request('GET', '/api/v2/admin/suppliers', null, tokens.admin);
  const sd0 = deep(suppliers);
  checkEq('供应商列表 200', suppliers.status, 200);
  check('至少 3 个启用供应商', Array.isArray(sd0.list) && sd0.list.filter(s => s.status === 1).length >= 3);
  console.log('   启用供应商数:', sd0.list ? sd0.list.filter(s => s.status === 1).length : 0);

  // 第二供应商（春熙路店）
  const SUP2_ID = '035cc75f-6b8f-4f5f-ae9b-98785b6140a4';
  const sup2Token = supplierToken(SUP2_ID);

  // 1. 创建刻章订单
  const create = await request('POST', '/api/v2/user/orders/seal', {
    totalAmount: 180,
    companyName: 'M4供应商测试公司',
    legalPerson: '王五',
    sealCount: 1,
    sealTypes: ['合同章'],
    filingRequired: false,
    remark: 'm4-supplier-flow-test',
  }, tokens.user);
  checkEq('创建订单 201', create.status, 201);
  const cd = deep(create);
  orderNo = cd.orderNo;
  console.log('   orderNo:', orderNo);

  // 2. 支付
  const pay = await request('POST', `/api/v2/user/orders/${orderNo}/pay`, {}, tokens.user);
  const pd = deep(pay);
  paymentNo = pd.paymentNo;
  await request('POST', '/api/v2/payments/wechat/notify', {
    out_trade_no: paymentNo, transaction_id: 'M4SPTX' + Date.now(), total_fee: 18000,
    return_code: 'SUCCESS', result_code: 'SUCCESS', trade_state: 'SUCCESS',
  });

  const detail0 = await request('GET', `/api/v2/user/orders/${orderNo}`, null, tokens.user);
  orderId = deep(detail0).order.id;

  // 3. 派单给供应商1
  const assign = await request('POST', `/api/v2/admin/orders/${orderNo}/assign`, { supplierId: L.OUTLET_ID }, tokens.admin);
  checkEq('派单 201', assign.status, 201);
  const ad = deep(assign);
  fulfillmentId = ad.fulfillmentId || ad.id;
  flNo = ad.fulfillmentNo || ad.fulfillment_no;
  check('返回 fulfillmentId', typeof fulfillmentId === 'string');

  // 4. 供应商1 待接单列表
  const pendingList = await request('GET', '/api/v2/supplier/orders?status=assigned', null, tokens.supplier);
  const pld = deep(pendingList);
  check('待接单列表含本单', (pld.list || []).some(o => o.orderNo === orderNo));
  check('列表字段 camelCase', (pld.list || []).some(o => o.fulfillmentId || o.id));

  // 5. 供应商2 看不到此单（无权）
  const sup2List = await request('GET', '/api/v2/supplier/orders', null, sup2Token);
  const s2d = deep(sup2List);
  check('其他供应商列表不含本单', !(s2d.list || []).some(o => o.orderNo === orderNo));

  // 6. 供应商2 尝试接单 → 400 无权
  const wrongAccept = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/accept`, {}, sup2Token);
  check('越权接单被拒', wrongAccept.status === 400 || wrongAccept.status === 403);

  // 7. 供应商1 接单
  const accept = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/accept`, {}, tokens.supplier);
  checkEq('接单 201', accept.status, 201);

  // 8. 开始制作
  const start = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/start`, {}, tokens.supplier);
  checkEq('制作 201', start.status, 201);

  // 9. 上传回执（multipart 单文件）——用真实文件
  const uploadPath = path.join(__dirname, 'fixtures', 'receipt_test.png');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    // 生成 1x1 PNG
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(uploadPath, png);
  }
  const uploadRes = await uploadFile(`/api/v2/supplier/fulfillments/${fulfillmentId}/receipts`, uploadPath, 'production', tokens.supplier);
  checkEq('上传回执 201', uploadRes.status, 201);
  const upd = deep(uploadRes);
  check('回执返回 urls', Array.isArray(upd.urls) && upd.urls.length === 1);

  // 10. 供应商已完成列表（应含回执）
  const doneList = await request('GET', '/api/v2/supplier/orders?status=processing', null, tokens.supplier);
  const dld = deep(doneList);
  const hit = (dld.list || []).find(o => o.orderNo === orderNo);
  check('制作中列表含本单', !!hit);
  check('列表返回回执照片', hit && Array.isArray(hit.productionPhotos) && hit.productionPhotos.length === 1);

  // 11. 发货
  const deliver = await request('POST', `/api/v2/supplier/orders/${fulfillmentId}/deliver`, { courier: '顺丰速运', trackingNo: 'SF' + Date.now() }, tokens.supplier);
  checkEq('发货 201', deliver.status, 201);

  // 12. 用户确认收货
  const confirm = await request('POST', `/api/v2/user/orders/${orderNo}/confirm`, {}, tokens.user);
  checkEq('确认收货 201', confirm.status, 201);

  // 13. 供应商结算列表（空/可用）
  const settlements = await request('GET', '/api/v2/supplier/settlements', null, tokens.supplier);
  checkEq('供应商结算列表 200', settlements.status, 200);

  // 14. 清理
  await cleanupByOrderId(orderId);

  // 兜底清理（防止中途失败残留）
  await cleanupByRemark('m4-%');
  const r = summarize();
  process.exit(r.failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });

// multipart 上传
function uploadFile(apiPath, filePath, type, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----M4Boundary' + Date.now();
    const content = fs.readFileSync(filePath);
    const fileBuf = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\nContent-Type: image/png\r\n\r\n`);
    const typeBuf = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${type}\r\n`);
    const endBuf = Buffer.from(`--${boundary}--\r\n`);
    const body = Buffer.concat([fileBuf, content, Buffer.from('\r\n'), typeBuf, endBuf]);
    const u = new URL(L.BASE + apiPath);
    const r = require('http').request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (e) {}
        resolve({ status: res.statusCode, body: parsed, raw: buf });
      });
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}
