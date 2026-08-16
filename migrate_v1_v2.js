// V1.0 → V2.0 数据迁移脚本
// 源：seal_orders（35 条真实订单：18 刻章 + 16 登报 + 1 测试）
//     order_items（33 条明细，仅作快照备份）
// 目标：orders（V2.0 统一订单主表）
//       seal_order_details / newspaper_order_details（业务明细）
//       order_events（事件追溯）
//       order_addresses（收货地址）
//       migration_seal_orders_snapshot（原始数据快照）
// 幂等：orders.order_no 已存在则跳过
// 说明：newspapers / bookkeeping_packages 是目录表（非订单），不迁移；
//       order_items 表结构对齐 V2.0 留待 API 阶段（避免破坏旧接口）

process.env.NODE_PATH = 'D:\\rongcheng-admin\\server\\node_modules';
require('module')._initPaths();
const { Client } = require('pg');

const client = new Client({ host:'localhost', port:5432, database:'rongcheng', user:'postgres', password:'wuhongyuan198911' });

// V1 status → V2.0 五维状态映射
// V1: 1待支付 / 2已支付 / 4已收货 / 7售后中
function mapStatus(v1Status) {
  switch (Number(v1Status)) {
    case 1: return { order_status:'pending_payment', payment_status:'unpaid', fulfillment_status:'pending_assignment', refund_status:'none', invoice_status:'not_required' };
    case 2: return { order_status:'paid', payment_status:'paid', fulfillment_status:'pending_assignment', refund_status:'none', invoice_status:'not_required' };
    case 4: return { order_status:'completed', payment_status:'paid', fulfillment_status:'completed', refund_status:'none', invoice_status:'not_required' };
    case 7: return { order_status:'processing', payment_status:'paid', fulfillment_status:'processing', refund_status:'applying', invoice_status:'not_required' };
    default: return { order_status:'created', payment_status:'unpaid', fulfillment_status:'pending_assignment', refund_status:'none', invoice_status:'not_required' };
  }
}

function parseAddress(jsonStr) {
  if (!jsonStr) return null;
  try {
    const a = JSON.parse(jsonStr);
    return {
      receiver_name: a.name || '',
      receiver_phone: a.phone || '',
      province: a.province || null,
      city: a.city || null,
      district: a.district || null,
      address: a.detail || ''
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  await client.connect();
  console.log('=== V1.0 → V2.0 数据迁移 ===\n');

  // 读取 V1 订单
  const { rows: sealOrders } = await client.query('SELECT * FROM seal_orders ORDER BY created_at');
  console.log(`V1 seal_orders: ${sealOrders.length} 条`);

  // 读取 V1 明细（仅备份用）
  const { rows: items } = await client.query('SELECT * FROM order_items');
  console.log(`V1 order_items: ${items.length} 条（快照备份）\n`);

  let created = 0, skipped = 0, failed = 0;

  for (const so of sealOrders) {
    // 幂等检查
    const exists = await client.query('SELECT id FROM orders WHERE order_no = $1', [so.order_no]);
    if (exists.rows.length > 0) { skipped++; continue; }

    const isNewspaper = so.newspaper_content && String(so.newspaper_content).trim() !== '';
    const module = isNewspaper ? 'newspaper' : 'seal';
    const st = mapStatus(so.status);
    const addr = parseAddress(so.address_json);

    const total = Number(so.total_price) || 0;
    const pay = so.pay_price != null ? Number(so.pay_price) : (so.pay_time ? total : 0);
    const paid = so.pay_time ? (so.pay_price != null ? Number(so.pay_price) : total) : 0;

    const orderId = so.id; // seal_orders.id 是 uuid 文本，直接复用

    try {
      await client.query('BEGIN');

      // 1. 订单主表
      await client.query(`
        INSERT INTO orders (id, order_no, user_id, module, service_id,
          order_status, payment_status, fulfillment_status, refund_status, invoice_status,
          total_amount, discount_amount, pay_amount, refund_amount, paid_amount,
          address_snapshot, customer_remark, admin_remark,
          reviewed_by, reviewed_at, review_result,
          paid_at, completed_at, cancelled_at, cancel_reason,
          version, created_at, updated_at, deleted_at)
        VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,0,$11,0,$12,$13,$14,$15,
          NULL,NULL,NULL,$16,$17,NULL,NULL,1,$18,$18,NULL)`,
        [orderId, so.order_no, so.user_id, module,
         st.order_status, st.payment_status, st.fulfillment_status, st.refund_status, st.invoice_status,
         total, pay, paid,
         addr ? JSON.stringify(addr) : null,
         so.remark || null, so.admin_remark || null,
         so.pay_time || null,
         Number(so.status) === 4 ? so.updated_at : null,
         so.created_at]);

      // 2. 业务明细
      if (isNewspaper) {
        await client.query(`
          INSERT INTO newspaper_order_details
            (id, order_id, newspaper_id, newspaper_name, newspaper_code,
             template_id, template_type, content, content_char_count, copies,
             publication_date, publication_edition, publication_proof)
          VALUES (gen_random_uuid(), $1, $2, $3, NULL, NULL, NULL, $4, $5, $6, NULL, NULL, NULL)`,
          [orderId,
           so.newspaper_id || null,
           '测试报纸',
           so.newspaper_content,
           (so.newspaper_content || '').length,
           so.newspaper_copy_count || 1]);
      } else {
        // seal_order_details：company_name/legal_person 等必填
        const itemsForOrder = items.filter(i => i.order_id === so.id);
        const sealTypes = itemsForOrder.map(i => i.name).filter(Boolean);
        // PG 数组字面量：空数组用 '{}'（'[]' 非法）
        const sealTypesArr = sealTypes.length ? ('{' + sealTypes.map(s => '"' + s.replace(/["\\]/g, '\\$&') + '"').join(',') + '}') : '{}';
        await client.query(`
          INSERT INTO seal_order_details
            (id, order_id, company_name, legal_person, license_no, license_region,
             license_expiry_date, seal_package_id, seal_package_name, seal_count, seal_types,
             filing_required, filing_region, filing_no, filed_at,
             production_requirement, delivery_requirement)
          VALUES (gen_random_uuid(), $1, $2, $3, '', $4, NULL, NULL, NULL, $5, $6::text[],
                  FALSE, NULL, NULL, NULL, NULL, NULL)`,
          [orderId,
           so.company_name || '未填写',
           so.legal_person || '未填写',
           so.license_region || null,
           itemsForOrder.length || 1,
           sealTypesArr]);
      }

      // 3. 收货地址（V2.0 order_addresses，user_id 可空）
      if (addr && addr.receiver_name && addr.receiver_phone) {
        await client.query(`
          INSERT INTO order_addresses
            (id, order_id, user_id, receiver_name, receiver_phone,
             province, city, district, address, is_default)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, FALSE)`,
          [orderId, so.user_id, addr.receiver_name, addr.receiver_phone,
           addr.province, addr.city, addr.district, addr.address]);
      }

      // 4. 事件
      await client.query(`
        INSERT INTO order_events (id, order_id, event_type, event_name, from_status, to_status, operator_type, operator_id, description)
        VALUES (gen_random_uuid(), $1, 'ORDER_CREATED', '订单创建', NULL, $2, 'user', $3, 'V1.0 迁移')`,
        [orderId, st.order_status, so.user_id]);
      if (so.pay_time) {
        await client.query(`
          INSERT INTO order_events (id, order_id, event_type, event_name, from_status, to_status, operator_type, operator_id, description)
          VALUES (gen_random_uuid(), $1, 'PAYMENT_SUCCESS', '支付成功', 'unpaid', 'paid', 'system', NULL, 'V1.0 迁移（pay_time 存在）')`,
          [orderId]);
      }

      // 5. 原始快照
      await client.query(`
        INSERT INTO migration_seal_orders_snapshot (id, data, migrated_at, migrated_to, migrated_by)
        VALUES (gen_random_uuid(), $1, NOW(), $2, 'migrate_v1_v2.js')`,
        [JSON.stringify(so), orderId]);

      await client.query('COMMIT');
      created++;
    } catch (e) {
      await client.query('ROLLBACK');
      failed++;
      console.error(`  ❌ 迁移失败 ${so.order_no}: ${e.message.slice(0, 120)}`);
    }
  }

  console.log(`\n✅ 迁移完成: 新建 ${created} 条，跳过 ${skipped} 条，失败 ${failed} 条`);

  // 汇总验证
  const r = await client.query('SELECT module, COUNT(*) FROM orders GROUP BY module ORDER BY module');
  console.log('\norders 表分布:', r.rows.map(x => `${x.module}=${x.count}`).join(', '));
  const r2 = await client.query('SELECT COUNT(*) as c FROM seal_order_details');
  const r3 = await client.query('SELECT COUNT(*) as c FROM newspaper_order_details');
  const r4 = await client.query('SELECT COUNT(*) as c FROM order_addresses');
  const r5 = await client.query('SELECT COUNT(*) as c FROM order_events');
  const r6 = await client.query('SELECT COUNT(*) as c FROM migration_seal_orders_snapshot');
  console.log(`seal_order_details=${r2.rows[0].c}, newspaper_order_details=${r3.rows[0].c}, order_addresses=${r4.rows[0].c}, order_events=${r5.rows[0].c}, snapshot=${r6.rows[0].c}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
