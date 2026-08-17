// M4 测试清理工具：按 orderId 清理 V2.0 订单关联数据（FK 顺序敏感）
'use strict';
const { Client } = require('pg');

const CONN = process.env.M4_PG_CONN || 'postgresql://postgres:wuhongyuan198911@localhost:5432/rongcheng';

async function getClient() {
  const c = new Client({ connectionString: CONN });
  await c.connect();
  return c;
}

// 按 orderId 清理一个 V2.0 订单的全部关联数据
async function cleanupByOrderId(orderId) {
  if (!orderId) return;
  const c = await getClient();
  try {
    // 先查履约单 id（fulfillment_orders 关联）
    const fls = await c.query('SELECT id FROM fulfillment_orders WHERE order_id = $1', [orderId]);
    const flIds = fls.rows.map(r => r.id);
    for (const flId of flIds) {
      await c.query('DELETE FROM seal_fulfillment_records WHERE fulfillment_order_id = $1', [flId]);
      await c.query('DELETE FROM fulfillment_assignments WHERE fulfillment_order_id = $1', [flId]);
      // settlement_items 可能引用 fulfillment_order_id
      await c.query('DELETE FROM settlement_items WHERE fulfillment_order_id = $1', [flId]);
    }
    await c.query('DELETE FROM fulfillment_orders WHERE order_id = $1', [orderId]);
    // 结算单（通过 settlement_items 关联 order_id）
    const sis = await c.query('SELECT DISTINCT settlement_id FROM settlement_items WHERE order_id = $1', [orderId]);
    for (const row of sis.rows) {
      await c.query('DELETE FROM supplier_payouts WHERE settlement_id = $1', [row.settlement_id]);
      await c.query('DELETE FROM settlement_records WHERE id = $1', [row.settlement_id]);
    }
    await c.query('DELETE FROM settlement_items WHERE order_id = $1', [orderId]);
    // 退款单
    await c.query('DELETE FROM refund_orders WHERE order_id = $1', [orderId]);
    // 支付
    const pays = await c.query('SELECT id FROM payment_orders WHERE order_id = $1', [orderId]);
    for (const row of pays.rows) {
      await c.query('DELETE FROM payment_transactions WHERE payment_id = $1', [row.id]);
    }
    await c.query('DELETE FROM payment_orders WHERE order_id = $1', [orderId]);
    // 明细/事件/地址/材料
    await c.query('DELETE FROM seal_order_details WHERE order_id = $1', [orderId]);
    await c.query('DELETE FROM newspaper_order_details WHERE order_id = $1', [orderId]);
    await c.query('DELETE FROM bookkeeping_order_details WHERE order_id = $1', [orderId]);
    await c.query('DELETE FROM order_items_v2 WHERE order_id = $1', [orderId]);
    await c.query('DELETE FROM order_addresses WHERE order_id = $1', [orderId]);
    await c.query('DELETE FROM order_materials WHERE order_id = $1', [orderId]);
    await c.query('DELETE FROM order_events WHERE order_id = $1', [orderId]);
    // 最后删订单
    const r = await c.query('DELETE FROM orders WHERE id = $1', [orderId]);
    return r.rowCount;
  } finally {
    await c.end();
  }
}

// 查询订单基线
async function getBaseline() {
  const c = await getClient();
  try {
    const r = await c.query('SELECT count(*)::int AS c FROM orders');
    return r.rows[0].c;
  } finally {
    await c.end();
  }
}

// 按 customer_remark 前缀兜底清理（防止测试中途失败残留）
async function cleanupByRemark(remarkPattern) {
  const c = await getClient();
  try {
    const r = await c.query('SELECT id FROM orders WHERE customer_remark LIKE $1', [remarkPattern]);
    for (const row of r.rows) {
      await cleanupByOrderId(row.id);
    }
    return r.rows.length;
  } finally {
    await c.end();
  }
}

module.exports = { cleanupByOrderId, cleanupByRemark, getBaseline, getClient };
