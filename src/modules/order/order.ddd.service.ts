// DDD 架构 - 订单服务（新架构）
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

  /**
   * 获取我的订单列表（支持分页）
   */
  async getMyOrders(userId: string, options?: {
    bizType?: string;
    status?: number;
    page?: number;
    pageSize?: number;
  }) {
    const { bizType, status, page = 1, pageSize = 20 } = options || {};

    const where: any = { user_id: userId };
    if (bizType) where.biz_type = bizType;
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.orderRepo.findMany(where, {
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          order_items_new: true,
          order_seal_details: true,
          order_newspaper_details: true,
          order_bookkeeping_details: true,
        }
      }),
      this.orderRepo.count(where)
    ]);

    return {
      list: orders,
      total,
      page,
      pageSize
    };
  }

  /**
   * 获取订单详情（带业务明细）
   */
  async getOrderDetail(orderNo: string, userId?: string) {
    const order = await this.orderRepo.findWithDetails(orderNo);

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 权限检查（非管理员只能查看自己的订单）
    if (userId && order.user_id !== userId) {
      throw new BadRequestException('无权查看此订单');
    }

    // 获取有效履约单
    const fulfillment = await this.fulfillmentRepo.findActiveByOrder(order.id);

    return {
      ...order,
      fulfillment
    };
  }

  /**
   * 管理员查询订单列表
   */
  async adminGetOrders(options?: {
    bizType?: string;
    status?: number;
    userId?: string;
    orderNo?: string;
    page?: number;
    pageSize?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const {
      bizType,
      status,
      userId,
      orderNo,
      page = 1,
      pageSize = 20,
      startDate,
      endDate
    } = options || {};

    const where: any = {};
    if (bizType) where.biz_type = bizType;
    if (status !== undefined) where.status = status;
    if (userId) where.user_id = userId;
    if (orderNo) where.order_no = { contains: orderNo };
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = endDate;
    }

    const [orders, total] = await Promise.all([
      this.orderRepo.findMany(where, {
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
          order_items_new: true,
          fulfillment_orders: {
            where: { is_active: true },
            take: 1,
            include: { supplier: true }
          }
        }
      }),
      this.orderRepo.count(where)
    ]);

    return {
      list: orders,
      total,
      page,
      pageSize
    };
  }

  /**
   * 获取统计数据
   */
  async getStatistics(userId?: string) {
    const where = userId ? { user_id: userId } : {};

    const [
      totalOrders,
      pendingPayment,
      inProgress,
      completed,
      totalAmount
    ] = await Promise.all([
      this.orderRepo.count(where),
      this.orderRepo.count({ ...where, status: 1 }),
      this.orderRepo.count({ ...where, status: { in: [2, 3] } }),
      this.orderRepo.count({ ...where, status: 4 }),
      this.prisma.order_orders.aggregate({
        where,
        _sum: { total_amount: true }
      })
    ]);

    return {
      totalOrders,
      pendingPayment,
      inProgress,
      completed,
      totalAmount: totalAmount._sum.total_amount || 0
    };
  }

  // ============ 订单创建 ============

  /**
   * 创建刻章订单（DDD 版）
   */
  async createSealOrder(userId: string, data: {
    company_name: string;
    legal_person: string;
    license_region: string;
    license_address: string;
    seal_reason?: string;
    contact_phone: string;
    legal_phone?: string;
    address_id?: string;
    address_json?: any;
    need_invoice?: boolean;
    invoice_id?: string;
    invoice_json?: any;
    items: Array<{
      seal_id: string;
      seal_name: string;
      seal_material?: string;
      price: number;
      quantity: number;
    }>;
    remark?: string;
  }) {
    const orderNo = await this.generateOrderNo('RC');

    const totalAmount = data.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    return this.prisma.$transaction(async (tx) => {
      // 创建订单主表
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

      // 创建订单明细
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

      // 创建刻章业务明细
      await tx.order_seal_details.create({
        data: {
          order_id: order.id,
          company_name: data.company_name,
          legal_person: data.legal_person,
          license_region: data.license_region,
          license_address: data.license_address,
          seal_reason: data.seal_reason,
          contact_phone: data.contact_phone,
          legal_phone: data.legal_phone,
          address_id: data.address_id,
          address_json: data.address_json ? JSON.stringify(data.address_json) : null,
          need_invoice: data.need_invoice || false,
          invoice_id: data.invoice_id,
          invoice_json: data.invoice_json ? JSON.stringify(data.invoice_json) : null
        }
      });

      return order;
    });
  }

  /**
   * 创建登报订单（DDD 版）
   */
  async createNewspaperOrder(userId: string, data: {
    newspaper_type?: string;
    newspaper_id?: string;
    section_id?: string;
    section_name?: string;
    content?: string;
    issue_count?: number;
    copy_count?: number;
    images?: string;
    total_amount: number;
    remark?: string;
  }) {
    const orderNo = await this.generateOrderNo('NP');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order_orders.create({
        data: {
          order_no: orderNo,
          user_id: userId,
          biz_type: 'newspaper',
          biz_subtype: data.newspaper_type || '普通公告',
          total_amount: data.total_amount,
          status: 1,
          status_text: '待付款',
          remark: data.remark
        }
      });

      await tx.order_newspaper_details.create({
        data: {
          order_id: order.id,
          newspaper_id: data.newspaper_id,
          section_id: data.section_id,
          section_name: data.section_name,
          content: data.content,
          issue_count: data.issue_count || 1,
          copy_count: data.copy_count || 1,
          images: data.images
        }
      });

      return order;
    });
  }

  // ============ 订单状态更新 ============

  /**
   * 取消订单
   */
  async cancelOrder(orderNo: string, userId: string, reason?: string) {
    const order = await this.orderRepo.findByOrderNo(orderNo);

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.user_id !== userId) {
      throw new BadRequestException('无权操作此订单');
    }

    if (order.status !== 1) {
      throw new BadRequestException('只能取消待付款订单');
    }

    return this.orderRepo.updateStatus(order.id, 5, '已取消');
  }

  /**
   * 支付成功回调（DDD 版）
   */
  async onPaymentSuccess(orderNo: string, paymentData: {
    transaction_id: string;
    pay_method: string;
    paid_amount: number;
  }) {
    const order = await this.orderRepo.findByOrderNo(orderNo);

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return this.prisma.$transaction(async (tx) => {
      // 更新订单状态
      await tx.order_orders.update({
        where: { id: order.id },
        data: {
          status: 2,
          status_text: '已付款',
          pay_amount: paymentData.paid_amount,
          paid_at: new Date()
        }
      });

      // 创建支付记录
      await tx.payment_orders.create({
        data: {
          payment_no: await this.generatePaymentNo(),
          order_id: order.id,
          user_id: order.user_id,
          amount: order.total_amount,
          paid_amount: paymentData.paid_amount,
          status: 2,
          pay_method: paymentData.pay_method,
          transaction_id: paymentData.transaction_id,
          paid_at: new Date()
        }
      });

      // 自动派单逻辑（如果配置启用）
      // TODO: 调用 fulfillmentRepo 创建履约单
    });
  }

  // ============ 辅助方法 ============

  /**
   * 生成订单号
   */
  private async generateOrderNo(prefix: string): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await this.orderRepo.count({
      order_no: { startsWith: `${prefix}${dateStr}` }
    });

    const seq = (count + 1).toString().padStart(6, '0');
    return `${prefix}${dateStr}${seq}`;
  }

  /**
   * 生成支付单号
   */
  private async generatePaymentNo(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await this.paymentRepo.count({
      payment_no: { startsWith: `PAY${dateStr}` }
    });

    const seq = (count + 1).toString().padStart(4, '0');
    return `PAY${dateStr}${seq}`;
  }
}
