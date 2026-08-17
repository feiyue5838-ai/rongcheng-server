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

    await this.prisma.sealOrderDetails.create({
      data: {
        orderId: order.id,
        companyName: data.companyName || '未填写',
        legalPerson: data.legalPerson || '未填写',
        licenseNo: data.licenseNo || '',
        licenseRegion: data.licenseRegion,
        licenseExpiryDate: data.licenseExpiryDate ? new Date(data.licenseExpiryDate) : null,
        sealPackageId: data.sealPackageId,
        sealPackageName: data.sealPackageName,
        sealCount: data.sealCount || 1,
        sealTypes: data.sealTypes || [],
        filingRequired: !!data.filingRequired,
        filingRegion: data.filingRegion,
        productionRequirement: data.productionRequirement,
        deliveryRequirement: data.deliveryRequirement,
        createdAt: new Date(),
        updatedAt: new Date(),
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
   * 创建登报订单
   */
  async createNewspaperOrder(userId: string, data: any) {
    const orderNo = await this.generateOrderNo('NP');

    const order = await this.prisma.orders.create({
      data: {
        order_no: orderNo,
        user_id: userId,
        module: 'newspaper',
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

    await this.prisma.newspaperOrderDetails.create({
      data: {
        orderId: order.id,
        newspaperId: data.newspaperId,
        newspaperName: data.newspaperName,
        newspaperCode: data.newspaperCode,
        templateId: data.templateId,
        templateType: data.templateType,
        content: data.content,
        contentCharCount: data.contentCharCount,
        copies: data.copies || 1,
        publicationDate: data.publicationDate ? new Date(data.publicationDate) : null,
        publicationEdition: data.publicationEdition,
        createdAt: new Date(),
        updatedAt: new Date(),
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
   * 创建记账订单
   */
  async createBookkeepingOrder(userId: string, data: any) {
    const orderNo = await this.generateOrderNo('BK');

    const order = await this.prisma.orders.create({
      data: {
        order_no: orderNo,
        user_id: userId,
        module: 'bookkeeping',
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

    await this.prisma.bookkeepingOrderDetails.create({
      data: {
        orderId: order.id,
        packageId: data.packageId,
        packageName: data.packageName,
        taxpayerType: data.taxpayerType || 'small_scale',
        servicePeriod: data.servicePeriod,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        companyName: data.companyName,
        businessLicenseNo: data.businessLicenseNo,
        taxAuthority: data.taxAuthority,
        accountingScope: data.accountingScope,
        currentPeriod: data.currentPeriod || 1,
        periodsCompleted: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
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

    // 幂等：复用已有 pending 支付单
    let pay = await this.prisma.payment_orders.findFirst({
      where: { order_id: order.id, status: 'pending' },
      orderBy: { created_at: 'desc' },
    });

    if (!pay) {
      pay = await this.prisma.payment_orders.create({
        data: {
          payment_no: `PAY${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          order_id: order.id,
          user_id: userId,
          amount: order.pay_amount ?? order.total_amount ?? 0,
          payment_method: paymentMethod,
          status: 'pending',
        },
      });
    }

    // TODO: 调用微信统一下单（unifiedorder），写入 prepay_id/nonce_str/payment_params
    // 此处返回占位参数，微信支付联调时替换
    return {
      paymentNo: pay.payment_no,
      params: {
        appId: '',
        timeStamp: '',
        nonceStr: '',
        package: '',
        signType: 'RSA',
        paySign: '',
      },
    };
  }

  /**
   * 微信支付成功回调（幂等）
   * 微信服务器调用，免鉴权
   * 双保险：payment_orders.payment_no 唯一 + payment_transactions.provider_txn_id 唯一
   */
  async notifyPayment(payload: any) {
    // 解析微信回调（兼容 XML 解析后的 JSON 对象）
    const { out_trade_no: paymentNo, transaction_id: providerTxnId, total_fee, result_code, return_code } = payload || {};
    if (!paymentNo || !providerTxnId) {
      return { success: false, message: '参数缺失' };
    }
    if (return_code !== 'SUCCESS' || result_code !== 'SUCCESS') {
      return { success: false, message: '支付未成功' };
    }

    // 查支付单
    const pay = await this.prisma.payment_orders.findUnique({ where: { payment_no: paymentNo } });
    if (!pay) {
      return { success: false, message: '支付单不存在' };
    }

    // 幂等：已支付直接返回成功
    if (pay.status === 'paid') {
      return { success: true, idempotent: true };
    }

    // 金额校验（total_fee 单位分，转元）
    const feeYuan = total_fee != null ? Number(total_fee) / 100 : null;
    if (feeYuan != null && Math.abs(feeYuan - Number(pay.amount)) > 0.01) {
      return { success: false, message: '金额不匹配' };
    }

    try {
      // 写交易流水（provider_txn_id 唯一约束兜底防重）
      await this.prisma.payment_transactions.create({
        data: {
          payment_id: pay.id,
          transaction_no: `PT${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          provider_txn_id: providerTxnId,
          provider: 'wechat',
          channel: 'JSAPI',
          transaction_type: 'payment',
          amount: pay.amount,
          fee: 0,
          net_amount: pay.amount,
          currency: 'CNY',
          status: 'success',
          occurred_at: new Date(),
          raw_data: payload,
        },
      });
    } catch (e: any) {
      // provider_txn_id 重复 → 说明已入账，幂等返回成功
      if (e?.code === 'P2002') {
        return { success: true, idempotent: true };
      }
      throw e;
    }

    const now = new Date();

    // 更新支付单
    await this.prisma.payment_orders.update({
      where: { id: pay.id },
      data: { status: 'paid', paid_amount: pay.amount, transaction_id: providerTxnId, paid_at: now },
    });

    // 更新订单（仅未支付时推进）
    const order = await this.prisma.orders.findUnique({ where: { id: pay.order_id } });
    if (order && order.payment_status === 'unpaid') {
      await this.prisma.orders.update({
        where: { id: order.id },
        data: {
          order_status: 'paid',
          payment_status: 'paid',
          paid_amount: pay.amount,
          paid_at: now,
        },
      });

      // 事件溯源
      await this.prisma.orderEvents.create({
        data: {
          orderId: order.id,
          eventType: 'PAYMENT_SUCCESS',
          eventName: '支付成功',
          fromStatus: 'pending_payment',
          toStatus: 'paid',
          operatorType: 'system',
          description: `支付单 ${paymentNo}，微信流水 ${providerTxnId}`,
          metadata: { paymentNo, providerTxnId },
          createdAt: now,
        },
      });
    }

    return { success: true };
  }

  /**
   * 微信退款回调（幂等，骨架）
   */
  async notifyRefund(payload: any) {
    const { out_refund_no: refundNo, refund_status, success_time } = payload || {};
    if (!refundNo) return { success: false, message: '参数缺失' };

    const refund = await this.prisma.refund_orders.findUnique({ where: { refund_no: refundNo } });
    if (!refund) return { success: false, message: '退款单不存在' };

    if (refund.status === 'completed') {
      return { success: true, idempotent: true };
    }

    if (refund_status === 'SUCCESS') {
      const now = new Date();
      await this.prisma.refund_orders.update({
        where: { id: refund.id },
        data: { status: 'completed', refund_txn_id: payload.refund_id, refund_at: success_time ? new Date(success_time) : now },
      });
      return { success: true };
    }

    return { success: false, message: '退款未成功' };
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
