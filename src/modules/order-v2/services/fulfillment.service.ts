// V2.0 履约服务（简化版）
// 基于 fulfillment_orders + fulfillmentAssignments

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
        order_id: order.id,
        fulfillment_no: `FL${Date.now()}`,
        supplier_id: supplierId,
        status: 1,
        status_text: '已派单',
        assigned_by: adminId,
      },
    });

    await this.prisma.orders.update({
      where: { id: order.id },
      data: { fulfillment_status: 'assigned' },
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

    await this.prisma.fulfillment_orders.update({
      where: { id: fulfillmentId },
      data: { status: 2, status_text: '已接单', accepted_at: new Date() },
    });

    await this.prisma.orders.update({
      where: { id: fulfillment.order_id },
      data: { fulfillment_status: 'accepted' },
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

    await this.prisma.fulfillment_orders.update({
      where: { id: fulfillmentId },
      data: { status: 4, status_text: '已拒单', canceled_at: new Date(), cancel_reason: reason },
    });

    await this.prisma.orders.update({
      where: { id: fulfillment.order_id },
      data: { fulfillment_status: 'pending_assignment' },
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
}
