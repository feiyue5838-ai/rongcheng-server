// DDD 架构 - 订单服务（完整版）
// 基于 order_orders 统一主表 + Repository 模式

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderRepository } from './repositories/order.repository';
import { PaymentRepository } from 'src/modules/payment/repositories/payment.repository';
import { FulfillmentRepository } from 'src/modules/fulfillment/repositories/fulfillment.repository';

@Injectable()
export class OrderDDDService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly fulfillmentRepo: FulfillmentRepository,
  ) {}

  // ============ 查询类方法 ============

  async getMyOrders(userId: string, options?: any) {
    const { bizType, status, page = 1, pageSize = 20 } = options || {};
    const where: any = { user_id: userId };
    if (bizType) where.biz_type = bizType;
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.orderRepo.findMany(where, {
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.orderRepo.count(where)
    ]);

    return { list: orders, total, page, pageSize };
  }

  async getOrderDetail(orderNo: string, userId?: string) {
    const order = await this.orderRepo.findWithDetails(orderNo);
    if (!order) throw new NotFoundException('订单不存在');
    if (userId && order.user_id !== userId) throw new BadRequestException('无权查看此订单');
    const fulfillment = await this.fulfillmentRepo.findActiveByOrder(order.id);
    return { ...order, fulfillment };
  }

  async adminGetOrders(options?: any) {
    const { bizType, status, userId, orderNo, page = 1, pageSize = 20 } = options || {};
    const where: any = {};
    if (bizType) where.biz_type = bizType;
    if (status !== undefined) where.status = status;
    if (userId) where.user_id = userId;
    if (orderNo) where.order_no = { contains: orderNo };

    const [orders, total] = await Promise.all([
      this.orderRepo.findMany(where, {
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.orderRepo.count(where)
    ]);

    return { list: orders, total, page, pageSize };
  }

  async getStatistics(userId?: string) {
    const where = userId ? { user_id: userId } : {};
    const [totalOrders, pendingPayment, inProgress, completed] = await Promise.all([
      this.orderRepo.count(where),
      this.orderRepo.count({ ...where, status: 1 }),
      this.orderRepo.count({ ...where, status: { in: [2, 3] } }),
      this.orderRepo.count({ ...where, status: 4 }),
    ]);
    return { totalOrders, pendingPayment, inProgress, completed };
  }

  // ============ 创建类方法 ============

  async createSealOrder(userId: string, data: any) {
    const orderNo = await this.generateOrderNo('RC');
    const totalAmount = data.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order_orders.create({
        data: {
          order_no: orderNo,
          user_id: userId,
          biz_type: 'seal',
          biz_subtype: data.items[0]?.seal_name || '公章',
          total_amount: totalAmount,
          status: 1,
          status_text: '待付款',
          remark: data.remark
        }
      });

      for (const item of data.items) {
        await tx.order_items_new.create({
          data: {
            order_id: order.id,
            item_type: 'seal',
            item_id: item.seal_id,
            name: item.seal_name,
            price: item.price,
            quantity: item.quantity,
            specs: item.seal_material
          }
        });
      }

      await tx.order_seal_details.create({
        data: {
          order_id: order.id,
          company_name: data.company_name || '',
          legal_person: data.legal_person || '',
          license_region: data.license_region || '',
          license_address: data.license_address || '',
          contact_phone: data.contact_phone || '',
        }
      });

      return order;
    });
  }

  async createNewspaperOrder(userId: string, data: any) {
    const orderNo = await this.generateOrderNo('NP');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order_orders.create({
        data: {
          order_no: orderNo,
          user_id: userId,
          biz_type: 'newspaper',
          total_amount: data.total_amount,
          status: 1,
          status_text: '待付款',
          remark: data.remark
        }
      });

      await tx.order_newspaper_details.create({
        data: {
          order_id: order.id,
          section_name: data.section_name || '',
          content: data.content || '',
        }
      });

      return order;
    });
  }

  // ============ 状态更新 ============

  async cancelOrder(orderNo: string, userId: string) {
    const order = await this.orderRepo.findByOrderNo(orderNo);
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== userId) throw new BadRequestException('无权操作此订单');
    if (order.status !== 1) throw new BadRequestException('只能取消待付款订单');
    return this.orderRepo.updateStatus(order.id, 5, '已取消');
  }

  async confirmReceive(orderNo: string, userId: string) {
    const order = await this.orderRepo.findByOrderNo(orderNo);
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== userId) throw new BadRequestException('无权操作此订单');
    if (order.status !== 4) throw new BadRequestException('订单未完成交付');
    return { success: true, message: '已确认收货' };
  }

  // ============ 派单履约 ============

  async getUnassignedOrders(options?: any) {
    const { bizType, page = 1, pageSize = 20 } = options || {};
    const where: any = { status: 2 };
    if (bizType) where.biz_type = bizType;

    const orders = await this.orderRepo.findMany(where, {
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { paid_at: 'asc' },
    });

    return { list: orders, total: orders.length, page, pageSize };
  }

  async getAssignedOrders(options?: any) {
    const { bizType, status, page = 1, pageSize = 20 } = options || {};
    const where: any = { status: { in: [3, 4] } };
    if (bizType) where.biz_type = bizType;

    const orders = await this.orderRepo.findMany(where, {
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: 'desc' },
    });

    return { list: orders, total: orders.length, page, pageSize };
  }

  async getSupplierOrders(supplierId: string, options?: any) {
    const { status, page = 1, pageSize = 20 } = options || {};

    const where: any = { supplier_id: supplierId, is_active: true };
    if (status !== undefined) where.status = status;

    const [fulfillments, total] = await Promise.all([
      this.prisma.fulfillment_orders.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { assigned_at: 'desc' },
        include: { order: true, supplier: true },
      }),
      this.prisma.fulfillment_orders.count({ where }),
    ]);

    return { list: fulfillments, total, page, pageSize };
  }

  async assignOrder(orderNo: string, supplierId: string, assignedBy?: string) {
    const order = await this.orderRepo.findByOrderNo(orderNo);
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 2) throw new BadRequestException('只能派单已付款订单');

    const activeFulfillment = await this.fulfillmentRepo.findActiveByOrder(order.id);

    return this.prisma.$transaction(async (tx) => {
      if (activeFulfillment) {
        await tx.fulfillment_orders.update({
          where: { id: activeFulfillment.id },
          data: {
            is_active: false,
            status: 6,
            status_text: '已换网点',
            canceled_at: new Date(),
          }
        });
      }

      const fulfillment = await tx.fulfillment_orders.create({
        data: {
          fulfillment_no: await this.generateFulfillmentNo(),
          order_id: order.id,
          supplier_id: supplierId,
          status: 1,
          status_text: '待接单',
          assigned_by: assignedBy,
          assigned_at: new Date(),
          is_active: true,
        }
      });

      return fulfillment;
    });
  }

  async acceptOrder(orderNo: string, supplierId: string) {
    const order = await this.orderRepo.findByOrderNo(orderNo);
    if (!order) throw new NotFoundException('订单不存在');

    const fulfillment = await this.fulfillmentRepo.findActiveByOrder(order.id);
    if (!fulfillment) throw new BadRequestException('订单未派单');
    if (fulfillment.supplier_id !== supplierId) throw new BadRequestException('无权操作此订单');
    if (fulfillment.status !== 1) throw new BadRequestException('只能接单待接单状态的订单');

    return this.prisma.$transaction(async (tx) => {
      await tx.fulfillment_orders.update({
        where: { id: fulfillment.id },
        data: { status: 2, status_text: '制作中', accepted_at: new Date() }
      });

      await tx.order_orders.update({
        where: { id: order.id },
        data: { status: 3, status_text: '制作中', fulfilled_at: new Date() }
      });

      return { success: true };
    });
  }

  async deliverOrder(orderNo: string, supplierId: string, data: any) {
    const order = await this.orderRepo.findByOrderNo(orderNo);
    if (!order) throw new NotFoundException('订单不存在');

    const fulfillment = await this.fulfillmentRepo.findActiveByOrder(order.id);
    if (!fulfillment) throw new BadRequestException('订单未派单');
    if (fulfillment.supplier_id !== supplierId) throw new BadRequestException('无权操作此订单');
    if (fulfillment.status !== 2) throw new BadRequestException('只能交付制作中状态的订单');

    return this.prisma.$transaction(async (tx) => {
      await tx.fulfillment_orders.update({
        where: { id: fulfillment.id },
        data: {
          status: 3,
          status_text: '已完成',
          completed_at: new Date(),
          is_active: false
        }
      });

      await tx.order_orders.update({
        where: { id: order.id },
        data: { status: 4, status_text: '已完成', completed_at: new Date() }
      });

      await tx.suppliers.update({
        where: { id: supplierId },
        data: { total_orders: { increment: 1 } }
      });

      return { success: true };
    });
  }

  // ============ 辅助方法 ============

  private async generateOrderNo(prefix: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.orderRepo.count({ order_no: { startsWith: `${prefix}${dateStr}` } });
    return `${prefix}${dateStr}${(count + 1).toString().padStart(6, '0')}`;
  }

  private async generateFulfillmentNo(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.fulfillment_orders.count({ where: { fulfillment_no: { startsWith: `FL${dateStr}` } } });
    return `FL${dateStr}${(count + 1).toString().padStart(4, '0')}`;
  }
}
