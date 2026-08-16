// V2.0 订单服务（简化版，无 Prisma 关系）
// 基于 orders 统一表（五维状态）

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrderV2Service {
  constructor(private readonly prisma: PrismaService) {}

  private async generateOrderNo(prefix: string): Promise<string> {
    const timestamp = Date.now().toString().slice(-10);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * 获取我的订单列表
   */
  async getMyOrders(userId: string, options: { tab?: string; module?: string; page?: number; pageSize?: number }) {
    const { tab, module, page = 1, pageSize = 20 } = options;
    const where: any = { user_id: userId, deleted_at: null };

    if (tab === 'pending_payment') {
      where.order_status = 'pending_payment';
    } else if (tab === 'paid') {
      where.order_status = 'paid';
      where.fulfillment_status = { in: ['pending_assignment', 'assigned', 'accepted', 'processing'] };
    } else if (tab === 'processing') {
      where.OR = [
        { fulfillment_status: { in: ['delivering', 'signed'] } },
        { refund_status: 'applying' },
      ];
    } else if (tab === 'completed') {
      where.order_status = 'completed';
    } else if (tab === 'after_sale') {
      where.refund_status = { in: ['applying', 'partial_refund', 'full_refund'] };
    }

    if (module) where.module = module;

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.orders.count({ where }),
    ]);

    const list = orders.map(o => ({
      orderNo: o.order_no,
      module: o.module,
      orderStatus: o.order_status,
      paymentStatus: o.payment_status,
      fulfillmentStatus: o.fulfillment_status,
      refundStatus: o.refund_status,
      totalAmount: o.total_amount?.toString(),
      createdAt: o.created_at?.toISOString(),
      items: [], // TODO: 查询 details
    }));

    return { list, total, page, pageSize };
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderNo: string, userId?: string) {
    const order = await this.prisma.orders.findUnique({ where: { order_no: orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (userId && order.user_id !== userId) throw new BadRequestException('无权查看此订单');

    // 分开查询 details/events
    const [sealDetails, newspaperDetails, events] = await Promise.all([
      this.prisma.sealOrderDetails.findMany({ where: { orderId: order.id } }),
      this.prisma.newspaperOrderDetails.findMany({ where: { orderId: order.id } }),
      this.prisma.orderEvents.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    return {
      order: {
        orderNo: order.order_no,
        module: order.module,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        refundStatus: order.refund_status,
        invoiceStatus: order.invoice_status,
        totalAmount: order.total_amount?.toString(),
        payAmount: order.pay_amount?.toString(),
        paidAmount: order.paid_amount?.toString(),
        addressSnapshot: order.address_snapshot,
        customerRemark: order.customer_remark,
        createdAt: order.created_at?.toISOString(),
        paidAt: order.paid_at?.toISOString(),
        completedAt: order.completed_at?.toISOString(),
      },
      sealDetails: sealDetails[0] || null,
      newspaperDetails: newspaperDetails[0] || null,
      events: events.map(e => ({
        eventType: e.eventType,
        eventName: e.eventName,
        createdAt: e.createdAt?.toISOString(),
      })),
    };
  }

  /**
   * 创建刻章订单
   */
  async createSealOrder(userId: string, data: any) {
    const orderNo = await this.generateOrderNo('SE');

    const order = await this.prisma.orders.create({
      data: {
        order_no: orderNo,
        user_id: userId,
        module: 'seal',
        order_status: 'pending_payment',
        payment_status: 'unpaid',
        fulfillment_status: 'pending_assignment',
        refund_status: 'none',
        invoice_status: 'not_required',
        total_amount: data.totalAmount || 0,
        pay_amount: data.totalAmount || 0,
        customer_remark: data.remark,
      },
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: order.id,
        eventType: 'ORDER_CREATED',
        eventName: '订单创建',
        fromStatus: '',
        toStatus: 'pending_payment',
        operatorType: 'user',
        operatorId: userId,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { orderNo, totalAmount: order.total_amount?.toString(), needPay: true };
  }

  /**
   * 获取支付参数
   */
  async getPayParams(orderNo: string, userId: string, paymentMethod: string = 'wechat') {
    const order = await this.prisma.orders.findUnique({ where: { order_no: orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== userId) throw new BadRequestException('无权操作此订单');
    if (order.order_status !== 'pending_payment') throw new BadRequestException('订单状态不允许支付');
    // TODO: 实现微信支付下单
    return { paymentNo: `PAY${Date.now()}`, params: {} };
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderNo: string, userId: string, reason?: string) {
    const order = await this.prisma.orders.findUnique({ where: { order_no: orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== userId) throw new BadRequestException('无权操作此订单');
    if (order.order_status !== 'pending_payment') throw new BadRequestException('仅待支付订单可取消');

    await this.prisma.orders.update({
      where: { id: order.id },
      data: { order_status: 'cancelled', cancelled_at: new Date() },
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: order.id,
        eventType: 'ORDER_CANCELLED',
        eventName: '订单取消',
        fromStatus: 'pending_payment',
        toStatus: 'cancelled',
        operatorType: 'user',
        operatorId: userId,
        description: reason,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * 确认收货
   */
  async confirmReceive(orderNo: string, userId: string) {
    const order = await this.prisma.orders.findUnique({ where: { order_no: orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== userId) throw new BadRequestException('无权操作此订单');
    if (order.fulfillment_status !== 'signed') throw new BadRequestException('仅已签收订单可确认');

    await this.prisma.orders.update({
      where: { id: order.id },
      data: { order_status: 'completed', fulfillment_status: 'completed', completed_at: new Date() },
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: order.id,
        eventType: 'ORDER_SIGNED',
        eventName: '确认收货',
        fromStatus: 'signed',
        toStatus: 'completed',
        operatorType: 'user',
        operatorId: userId,
        metadata: {},
        createdAt: new Date(),
      },
    });

    return { success: true };
  }
}
