// DDD 架构 - 数据迁移脚本（旧表 → 新表）
// 迁移策略：渐进式迁移，保留旧表，先写新表再切换

require('dotenv').config({ path: 'D:/rongcheng-admin/server/.env' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function migrateAll() {
  console.log('=== DDD 架构数据迁移 ===\n');
  console.log('开始时间:', new Date().toISOString());
  
  try {
    // 阶段 1：迁移 outlets → suppliers
    await migrateOutlets();
    
    // 阶段 2：迁移 seal_orders → order_orders
    await migrateSealOrders();
    
    // 阶段 3：迁移 newspapers → order_orders
    await migrateNewspapers();
    
    // 阶段 4：迁移 bookkeeping_packages → order_orders
    await migrateBookkeeping();
    
    // 阶段 5：迁移 order_assignments → fulfillment_orders
    await migrateAssignments();
    
    console.log('\n✅ 迁移完成');
    console.log('完成时间:', new Date().toISOString());
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    throw error;
  } finally {
    await p.$disconnect();
  }
}

// ============ 阶段 1：迁移 outlets → suppliers ============
async function migrateOutlets() {
  console.log('\n--- 阶段 1: outlets → suppliers ---');
  
  const outlets = await p.outlets.findMany({
    include: {
      outlet_business_types: true
    }
  });
  
  console.log(`找到 ${outlets.length} 个网点`);
  
  let created = 0;
  let skipped = 0;
  
  for (const outlet of outlets) {
    // 检查是否已迁移
    const exists = await p.suppliers.findFirst({
      where: { name: outlet.name }
    });
    
    if (exists) {
      skipped++;
      continue;
    }
    
    // 创建供应商
    const bizTypes = outlet.outlet_business_types
      .map(obt => obt.business_type)
      .join(',');
    
    await p.suppliers.create({
      data: {
        id: outlet.id, // 保持相同 ID
        name: outlet.name,
        contact: outlet.contact,
        phone: outlet.phone,
        status: outlet.status,
        province: outlet.province,
        city: outlet.city,
        district: outlet.district,
        address: outlet.address,
        biz_types: bizTypes,
        priority: outlet.priority || 0,
        total_orders: outlet.total_orders || 0,
        last_login_at: outlet.last_login_at,
        last_login_ip: outlet.last_login_ip,
        created_at: outlet.created_at,
        updated_at: outlet.updated_at
      }
    });
    
    created++;
  }
  
  console.log(`✅ 供应商迁移完成: 新建 ${created} 条，跳过 ${skipped} 条`);
}

// ============ 阶段 2：迁移 seal_orders → order_orders ============
async function migrateSealOrders() {
  console.log('\n--- 阶段 2: seal_orders → order_orders ---');
  
  const orders = await p.seal_orders.findMany({
    include: {
      order_items: true
    }
  });
  
  console.log(`找到 ${orders.length} 个刻章订单`);
  
  let created = 0;
  let skipped = 0;
  
  for (const order of orders) {
    // 检查是否已迁移
    const exists = await p.order_orders.findUnique({
      where: { order_no: order.order_no }
    });
    
    if (exists) {
      skipped++;
      continue;
    }
    
    await p.$transaction(async (tx) => {
      // 创建订单主表
      const newOrder = await tx.order_orders.create({
        data: {
          order_no: order.order_no,
          user_id: order.user_id,
          biz_type: 'seal',
          biz_subtype: order.seal_type,
          total_amount: order.total_amount,
          pay_amount: order.pay_amount,
          discount_amount: order.discount_amount || 0,
          status: mapSealStatus(order.status),
          status_text: mapSealStatusText(order.status),
          created_at: order.created_at,
          updated_at: order.updated_at,
          paid_at: order.paid_at,
          fulfilled_at: order.delivery_status === 1 ? order.delivery_time : null,
          completed_at: order.status === 4 ? order.updated_at : null,
          canceled_at: order.status === 5 ? order.updated_at : null,
          remark: order.remark,
          admin_remark: order.admin_remark
        }
      });
      
      // 创建订单明细
      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          await tx.order_items_new.create({
            data: {
              order_id: newOrder.id,
              item_type: 'seal',
              item_id: item.seal_id,
              name: item.seal_name || '刻章',
              price: item.price,
              quantity: item.quantity || 1,
              specs: item.seal_material
            }
          });
        }
      }
      
      // 创建刻章业务明细
      await tx.order_seal_details.create({
        data: {
          order_id: newOrder.id,
          company_name: order.company_name,
          legal_person: order.legal_person,
          license_region: order.license_region,
          license_address: order.license_address,
          seal_reason: order.seal_reason,
          contact_phone: order.contact_phone,
          legal_phone: order.legal_phone,
          address_id: order.address_id,
          address_json: order.address_json,
          need_invoice: order.need_invoice || false,
          invoice_id: order.invoice_id,
          invoice_json: order.invoice_json
        }
      });
      
      created++;
    });
  }
  
  console.log(`✅ 刻章订单迁移完成: 新建 ${created} 条，跳过 ${skipped} 条`);
}

// ============ 阶段 3：迁移 newspapers → order_orders ============
async function migrateNewspapers() {
  console.log('\n--- 阶段 3: newspapers → order_orders ---');
  
  const orders = await p.newspapers.findMany();
  
  console.log(`找到 ${orders.length} 个登报订单`);
  
  let created = 0;
  let skipped = 0;
  
  for (const order of orders) {
    const exists = await p.order_orders.findUnique({
      where: { order_no: order.order_no }
    });
    
    if (exists) {
      skipped++;
      continue;
    }
    
    await p.$transaction(async (tx) => {
      const newOrder = await tx.order_orders.create({
        data: {
          order_no: order.order_no,
          user_id: order.user_id,
          biz_type: 'newspaper',
          biz_subtype: order.newspaper_type,
          total_amount: order.total_amount,
          pay_amount: order.pay_amount,
          discount_amount: 0,
          status: mapNewspaperStatus(order.status),
          status_text: mapNewspaperStatusText(order.status),
          created_at: order.created_at,
          updated_at: order.updated_at,
          paid_at: order.paid_at,
          remark: order.remark,
          admin_remark: order.admin_remark
        }
      });
      
      await tx.order_newspaper_details.create({
        data: {
          order_id: newOrder.id,
          newspaper_id: order.newspaper_id,
          section_id: order.section_id,
          section_name: order.section_name,
          content: order.content,
          issue_count: order.issue_count || 1,
          copy_count: order.copy_count || 1,
          images: order.images
        }
      });
      
      created++;
    });
  }
  
  console.log(`✅ 登报订单迁移完成: 新建 ${created} 条，跳过 ${skipped} 条`);
}

// ============ 阶段 4：迁移 bookkeeping → order_orders ============
async function migrateBookkeeping() {
  console.log('\n--- 阶段 4: bookkeeping_packages → order_orders ---');
  
  const orders = await p.bookkeeping_packages.findMany({
    include: {
      bookkeeping_orders: true
    }
  });
  
  console.log(`找到 ${orders.length} 个记账订单`);
  
  let created = 0;
  let skipped = 0;
  
  for (const order of orders) {
    const exists = await p.order_orders.findUnique({
      where: { order_no: order.order_no }
    });
    
    if (exists) {
      skipped++;
      continue;
    }
    
    await p.$transaction(async (tx) => {
      const newOrder = await tx.order_orders.create({
        data: {
          order_no: order.order_no,
          user_id: order.user_id,
          biz_type: 'bookkeeping',
          total_amount: order.total_amount,
          pay_amount: order.pay_amount,
          discount_amount: 0,
          status: mapBookkeepingStatus(order.status),
          status_text: mapBookkeepingStatusText(order.status),
          created_at: order.created_at,
          updated_at: order.updated_at,
          paid_at: order.paid_at,
          remark: order.remark,
          admin_remark: order.admin_remark
        }
      });
      
      await tx.order_bookkeeping_details.create({
        data: {
          order_id: newOrder.id,
          package_id: order.package_id,
          taxpayer_type: order.taxpayer_type,
          cycle: order.cycle,
          service_months: order.service_months || 12,
          company_name: order.company_name,
          tax_no: order.tax_no
        }
      });
      
      created++;
    });
  }
  
  console.log(`✅ 记账订单迁移完成: 新建 ${created} 条，跳过 ${skipped} 条`);
}

// ============ 阶段 5：迁移 order_assignments → fulfillment_orders ============
async function migrateAssignments() {
  console.log('\n--- 阶段 5: order_assignments → fulfillment_orders ---');
  
  const assignments = await p.order_assignments.findMany({
    orderBy: { assigned_at: 'asc' }
  });
  
  console.log(`找到 ${assignments.length} 条派单记录`);
  
  let created = 0;
  let skipped = 0;
  
  for (const assignment of assignments) {
    // 检查是否已迁移
    const exists = await p.fulfillment_orders.findFirst({
      where: { fulfillment_no: `FL${assignment.id}` }
    });
    
    if (exists) {
      skipped++;
      continue;
    }
    
    // 查找对应的新订单
    const oldOrder = await p.seal_orders.findUnique({
      where: { id: assignment.order_id }
    });
    
    if (!oldOrder) {
      console.log(`  跳过派单 ${assignment.id}: 订单不存在`);
      skipped++;
      continue;
    }
    
    const newOrder = await p.order_orders.findUnique({
      where: { order_no: oldOrder.order_no }
    });
    
    if (!newOrder) {
      console.log(`  跳过派单 ${assignment.id}: 新订单未迁移`);
      skipped++;
      continue;
    }
    
    await p.fulfillment_orders.create({
      data: {
        fulfillment_no: `FL${assignment.id}`,
        order_id: newOrder.id,
        supplier_id: assignment.outlet_id,
        status: assignment.status,
        status_text: mapAssignmentStatusText(assignment.status),
        assigned_by: assignment.assigned_by,
        assigned_at: assignment.assigned_at,
        accepted_at: assignment.status >= 2 ? assignment.updated_at : null,
        completed_at: assignment.status === 4 ? assignment.updated_at : null,
        previous_id: assignment.previous_id ? `FL${assignment.previous_id}` : null,
        is_active: assignment.is_active !== false,
        canceled_at: assignment.canceled_at,
        cancel_reason: assignment.cancel_remark,
        delivery_method: assignment.delivery_method,
        express_company: assignment.express_company,
        express_no: assignment.express_no,
        delivered_at: assignment.delivered_at,
        signed_by: assignment.signed_by,
        signed_at: assignment.signed_at,
        sign_photo: assignment.sign_photo,
        remark: assignment.remark
      }
    });
    
    created++;
  }
  
  console.log(`✅ 履约单迁移完成: 新建 ${created} 条，跳过 ${skipped} 条`);
}

// ============ 状态映射函数 ============
function mapSealStatus(status) {
  const map = {
    1: 1, // 待付款
    2: 2, // 已付款/制作中
    3: 3, // 已发货
    4: 4, // 已完成
    5: 5, // 已取消
    6: 6, // 售后中
    7: 7, // 退款中
    8: 8  // 已退款
  };
  return map[status] || status;
}

function mapSealStatusText(status) {
  const map = {
    1: '待付款',
    2: '制作中',
    3: '已发货',
    4: '已完成',
    5: '已取消',
    6: '售后中',
    7: '退款中',
    8: '已退款'
  };
  return map[status] || '未知';
}

function mapNewspaperStatus(status) {
  const map = {
    1: 1, // 待付款
    2: 2, // 已付款
    3: 3, // 已刊登
    4: 4, // 已完成
    5: 5  // 已取消
  };
  return map[status] || status;
}

function mapNewspaperStatusText(status) {
  const map = {
    1: '待付款',
    2: '已付款',
    3: '已刊登',
    4: '已完成',
    5: '已取消'
  };
  return map[status] || '未知';
}

function mapBookkeepingStatus(status) {
  const map = {
    1: 1, // 待付款
    2: 2, // 服务中
    3: 3, // 已完成
    4: 4, // 已取消
    5: 5  // 已过期
  };
  return map[status] || status;
}

function mapBookkeepingStatusText(status) {
  const map = {
    1: '待付款',
    2: '服务中',
    3: '已完成',
    4: '已取消',
    5: '已过期'
  };
  return map[status] || '未知';
}

function mapAssignmentStatusText(status) {
  const map = {
    1: '待接单',
    2: '制作中',
    3: '已完成',
    4: '已拒绝',
    5: '已取消',
    6: '已换网点'
  };
  return map[status] || '未知';
}

// 执行迁移
migrateAll();
