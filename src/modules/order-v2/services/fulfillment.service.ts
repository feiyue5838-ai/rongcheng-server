// V2.0 履约服务
// 基于 fulfillment_orders（V2.0 结构：字符串状态）+ fulfillmentAssignments

import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FulfillmentService {
  constructor(private readonly prisma: PrismaService) {}

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

    return { list: orders, total, page, pageSize };
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
      const validStatuses = ['pending', 'assigned', 'accepted', 'processing', 'completed', 'cancelled'];
      if (validStatuses.includes(status)) {
        where.status = status;
      } else {
        delete where.status;
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

    return { list, total, page, pageSize };
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
