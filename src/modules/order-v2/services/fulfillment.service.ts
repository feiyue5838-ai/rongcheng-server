// V2.0 履约服务
// 基于 fulfillment_orders（V2.0 结构：字符串状态）+ fulfillmentAssignments

import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FulfillmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 管理端：供应商列表（派单/改派选择用）
   * GET /api/v2/admin/suppliers
   */
  async listSuppliers(options: { page?: number; pageSize?: number; keyword?: string }) {
    const { page = 1, pageSize = 50, keyword } = options;
    const where: any = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { contact: { contains: keyword } },
      ];
    }
    const [suppliers, total] = await Promise.all([
      this.prisma.suppliers.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.suppliers.count({ where }),
    ]);
    return {
      list: suppliers.map(s => ({
        id: s.id,
        name: s.name,
        contactName: s.contact,
        contactPhone: s.phone,
        region: [s.province, s.city, s.district].filter(Boolean).join(''),
        status: s.status,
        createdAt: s.created_at?.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getUnassignedOrders(options: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = options;
    const where = { fulfillment_status: 'pending_assignment', deleted_at: null };

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.orders.count({ where }),
    ]);

    return {
      list: orders.map(o => ({
        id: o.id,
        orderNo: o.order_no,
        module: o.module,
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        fulfillmentStatus: o.fulfillment_status,
        refundStatus: o.refund_status,
        totalAmount: o.total_amount?.toString(),
        customerRemark: o.customer_remark,
        createdAt: o.created_at?.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async assignOrder(orderNo: string, supplierId: string, adminId: string) {
    const order = await this.prisma.orders.findUnique({ where: { order_no: orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.fulfillment_status !== 'pending_assignment') throw new BadRequestException('订单已派单或状态不符');

    const supplier = await this.prisma.suppliers.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('供应商不存在');
    if (supplier.status !== 1) throw new BadRequestException('供应商未启用');

    const fulfillment = await this.prisma.fulfillment_orders.create({
      data: {
        fulfillment_no: `FL${Date.now()}`,
        order_id: order.id,
        order_no: order.order_no,
        module: order.module,
        supplier_id: supplierId,
        supplier_name: supplier.name,
        status: 'assigned',
        assigned_at: new Date(),
      },
    });

    await this.prisma.orders.updateMany({
      where: { id: order.id, version: order.version },
      data: { fulfillment_status: 'assigned', version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: order.id,
        eventType: 'ASSIGNMENT_CREATED',
        eventName: '派单成功',
        fromStatus: 'pending_assignment',
        toStatus: 'assigned',
        operatorType: 'admin',
        operatorId: adminId,
        description: `派给供应商: ${supplier.name}`,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true, fulfillmentId: fulfillment.id };
  }

  async reassignOrder(orderNo: string, newSupplierId: string, adminId: string, cancelRemark?: string) {
    const order = await this.prisma.orders.findUnique({ where: { order_no: orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.fulfillment_status !== 'assigned' && order.fulfillment_status !== 'pending_assignment') {
      throw new BadRequestException('当前状态不可改派');
    }

    const newSupplier = await this.prisma.suppliers.findUnique({ where: { id: newSupplierId } });
    if (!newSupplier) throw new NotFoundException('供应商不存在');
    if (newSupplier.status !== 1) throw new BadRequestException('供应商未启用');

    // 取消旧的未完成履约单（若存在）
    const oldFulfillments = await this.prisma.fulfillment_orders.findMany({
      where: { order_id: order.id, status: { in: ['assigned', 'accepted', 'processing'] } },
    });
    for (const f of oldFulfillments) {
      await this.prisma.fulfillment_orders.update({
        where: { id: f.id },
        data: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: cancelRemark || '改派' },
      });
    }

    // 创建新履约单
    const fulfillment = await this.prisma.fulfillment_orders.create({
      data: {
        fulfillment_no: `FL${Date.now()}`,
        order_id: order.id,
        order_no: order.order_no,
        module: order.module,
        supplier_id: newSupplierId,
        supplier_name: newSupplier.name,
        status: 'assigned',
        assigned_at: new Date(),
      },
    });

    // 乐观锁更新订单
    await this.prisma.orders.updateMany({
      where: { id: order.id, version: order.version },
      data: { fulfillment_status: 'assigned', version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
    });

    // 事件链
    if (oldFulfillments.length) {
      await this.prisma.orderEvents.create({
        data: {
          orderId: order.id,
          eventType: 'ASSIGNMENT_CANCELLED',
          eventName: '改派取消旧派单',
          fromStatus: order.fulfillment_status,
          toStatus: 'pending_assignment',
          operatorType: 'admin',
          operatorId: adminId,
          description: `改派：取消原供应商派单（${cancelRemark || '无备注'}）`,
          metadata: {},
          createdAt: new Date(),
        },
      });
    }
    await this.prisma.orderEvents.create({
      data: {
        orderId: order.id,
        eventType: 'ASSIGNMENT_CREATED',
        eventName: '派单成功',
        fromStatus: oldFulfillments.length ? 'pending_assignment' : order.fulfillment_status,
        toStatus: 'assigned',
        operatorType: 'admin',
        operatorId: adminId,
        description: `改派给供应商: ${newSupplier.name}`,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true, fulfillmentId: fulfillment.id, cancelledOld: oldFulfillments.length };
  }

  async acceptOrder(fulfillmentId: string, supplierId: string) {
    const fulfillment = await this.prisma.fulfillment_orders.findUnique({ where: { id: fulfillmentId } });
    if (!fulfillment) throw new NotFoundException('履约单不存在');
    if (fulfillment.supplier_id !== supplierId) throw new BadRequestException('无权操作此订单');
    if (fulfillment.status !== 'assigned') throw new BadRequestException('仅已派单的履约单可接单');

    await this.prisma.fulfillment_orders.update({
      where: { id: fulfillmentId },
      data: { status: 'accepted', accepted_at: new Date() },
    });

    const orderForVersion = await this.prisma.orders.findUnique({ where: { id: fulfillment.order_id } });
    await this.prisma.orders.updateMany({
      where: { id: fulfillment.order_id, version: orderForVersion?.version },
      data: { fulfillment_status: 'accepted', version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: fulfillment.order_id,
        eventType: 'SUPPLIER_ACCEPTED',
        eventName: '供应商接单',
        fromStatus: 'assigned',
        toStatus: 'accepted',
        operatorType: 'supplier',
        operatorId: supplierId,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true };
  }

  async rejectOrder(fulfillmentId: string, supplierId: string, reason: string) {
    const fulfillment = await this.prisma.fulfillment_orders.findUnique({ where: { id: fulfillmentId } });
    if (!fulfillment) throw new NotFoundException('履约单不存在');
    if (fulfillment.supplier_id !== supplierId) throw new BadRequestException('无权操作此订单');
    if (fulfillment.status !== 'assigned') throw new BadRequestException('仅已派单的履约单可拒单');

    await this.prisma.fulfillment_orders.update({
      where: { id: fulfillmentId },
      data: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: reason },
    });

    const orderForVersion = await this.prisma.orders.findUnique({ where: { id: fulfillment.order_id } });
    await this.prisma.orders.updateMany({
      where: { id: fulfillment.order_id, version: orderForVersion?.version },
      data: { fulfillment_status: 'pending_assignment', version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: fulfillment.order_id,
        eventType: 'SUPPLIER_REJECTED',
        eventName: '供应商拒单',
        fromStatus: 'assigned',
        toStatus: 'pending_assignment',
        operatorType: 'supplier',
        operatorId: supplierId,
        description: `拒单原因: ${reason}`,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * 供应商订单列表（按供应商维度查询履约单）
   */
  async getSupplierOrders(supplierId: string, options: { status?: string; page?: number; pageSize?: number }) {
    const { status, page = 1, pageSize = 20 } = options;
    const where: any = { supplier_id: supplierId };
    if (status) {
      const statusMap: Record<string, string[]> = {
        pending:   ['assigned'],
        accepted:  ['accepted'],
        processing:['processing'],
        completed:['completed'],
        rejected: ['cancelled'],
        cancelled: ['cancelled'],
      };
      const mapped = statusMap[status];
      if (mapped) {
        where.status = { in: mapped };
      }
    }

    const [list, total] = await Promise.all([
      this.prisma.fulfillment_orders.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { assigned_at: 'desc' },
      }),
      this.prisma.fulfillment_orders.count({ where }),
    ]);

    const statusText: Record<string, string> = {
      assigned: '待接单',
      accepted: '已接单',
      processing: '制作中',
      completed: '已完成',
      cancelled: '已取消',
    };

    return {
      list: list.map(f => ({
        id: f.id,
        fulfillmentNo: f.fulfillment_no,
        orderNo: f.order_no,
        orderId: f.order_id,
        module: f.module,
        supplierId: f.supplier_id,
        supplierName: f.supplier_name,
        status: f.status,
        statusText: statusText[f.status] || f.status,
        assignedAt: f.assigned_at?.toISOString(),
        acceptedAt: f.accepted_at?.toISOString(),
        startedAt: f.started_at?.toISOString(),
        completedAt: f.completed_at?.toISOString(),
        cancelledAt: f.cancelled_at?.toISOString(),
        cancelReason: f.cancel_reason,
        deliveryMethod: f.delivery_method,
        expressCompany: f.express_company,
        expressNo: f.express_no,
        deliveredAt: f.delivered_at?.toISOString(),
        remark: f.remark,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 开始制作（accepted → processing）
   */
  async startProduction(fulfillmentId: string, supplierId: string) {
    const fulfillment = await this.prisma.fulfillment_orders.findUnique({ where: { id: fulfillmentId } });
    if (!fulfillment) throw new NotFoundException('履约单不存在');
    if (fulfillment.supplier_id !== supplierId) throw new BadRequestException('无权操作此订单');
    if (fulfillment.status !== 'accepted') throw new BadRequestException('请先接单再开始制作');

    await this.prisma.fulfillment_orders.update({
      where: { id: fulfillmentId },
      data: { status: 'processing', started_at: new Date() },
    });

    const orderForVersion = await this.prisma.orders.findUnique({ where: { id: fulfillment.order_id } });
    await this.prisma.orders.updateMany({
      where: { id: fulfillment.order_id, version: orderForVersion?.version },
      data: { fulfillment_status: 'processing', version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: fulfillment.order_id,
        eventType: 'SUPPLIER_STARTED',
        eventName: '开始制作',
        fromStatus: 'accepted',
        toStatus: 'processing',
        operatorType: 'supplier',
        operatorId: supplierId,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * 发货（交付即完成：processing → completed）
   */
  async deliverOrder(fulfillmentId: string, supplierId: string, body: { courier?: string; trackingNo?: string }) {
    const fulfillment = await this.prisma.fulfillment_orders.findUnique({ where: { id: fulfillmentId } });
    if (!fulfillment) throw new NotFoundException('履约单不存在');
    if (fulfillment.supplier_id !== supplierId) throw new BadRequestException('无权操作此订单');
    if (fulfillment.status !== 'processing') throw new BadRequestException('请先开始制作再交付');

    await this.prisma.fulfillment_orders.update({
      where: { id: fulfillmentId },
      data: {
        status: 'completed',
        completed_at: new Date(),
        delivery_method: body?.courier ? 'express' : null,
        express_company: body?.courier || null,
        express_no: body?.trackingNo || null,
        delivered_at: new Date(),
        remark: body?.courier ? `快递: ${body.courier} ${body.trackingNo || ''}` : null,
      },
    });

    const orderForVersion = await this.prisma.orders.findUnique({ where: { id: fulfillment.order_id } });
    await this.prisma.orders.updateMany({
      where: { id: fulfillment.order_id, version: orderForVersion?.version },
      data: { fulfillment_status: 'completed', version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: fulfillment.order_id,
        eventType: 'SUPPLIER_DELIVERED',
        eventName: '供应商发货交付',
        fromStatus: 'processing',
        toStatus: 'completed',
        operatorType: 'supplier',
        operatorId: supplierId,
        description: body?.courier ? `快递: ${body.courier} ${body.trackingNo || ''}` : '',
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true, delivered: true };
  }

  /**
   * 完成履约（幂等兜底：已完成时直接返回成功）
   */
  async completeOrder(fulfillmentId: string, supplierId: string) {
    const fulfillment = await this.prisma.fulfillment_orders.findUnique({ where: { id: fulfillmentId } });
    if (!fulfillment) throw new NotFoundException('履约单不存在');
    if (fulfillment.supplier_id !== supplierId) throw new BadRequestException('无权操作此订单');
    if (fulfillment.status === 'completed') return { success: true, already: true };
    if (!['accepted', 'processing'].includes(fulfillment.status)) throw new BadRequestException('仅已接单/制作中的履约单可完成');

    const orderForVersion = await this.prisma.orders.findUnique({ where: { id: fulfillment.order_id } });
    await this.prisma.fulfillment_orders.update({
      where: { id: fulfillmentId },
      data: { status: 'completed', completed_at: new Date() },
    });

    await this.prisma.orders.updateMany({
      where: { id: fulfillment.order_id, version: orderForVersion?.version },
      data: { fulfillment_status: 'completed', version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: fulfillment.order_id,
        eventType: 'FULFILLMENT_COMPLETED',
        eventName: '履约完成',
        fromStatus: fulfillment.status,
        toStatus: 'completed',
        operatorType: 'supplier',
        operatorId: supplierId,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true };
  }
}
