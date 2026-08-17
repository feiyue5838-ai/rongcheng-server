// V2.0 订单服务（简化版，无 Prisma 关系）
// 基于 orders 统一表（五维状态）

import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WechatPayService } from './wechat-pay.service';

@Injectable()
export class OrderV2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatPay: WechatPayService,
  ) {}

  private async generateOrderNo(prefix: string): Promise<string> {
    const timestamp = Date.now().toString().slice(-10);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /** 解析地址快照：对象直接返回，JSON 字符串解析，空值返回 undefined */
  private parseAddressSnapshot(input: any): any {
    if (!input) return undefined;
    if (typeof input === 'object') return input;
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
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

    // 分开查询 details/events/fulfillment
    const [sealDetails, newspaperDetails, bookkeepingDetails, events, fulfillments] = await Promise.all([
      this.prisma.sealOrderDetails.findMany({ where: { orderId: order.id } }),
      this.prisma.newspaperOrderDetails.findMany({ where: { orderId: order.id } }),
      this.prisma.bookkeepingOrderDetails.findMany({ where: { orderId: order.id } }),
      this.prisma.orderEvents.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.fulfillment_orders.findMany({
        where: { order_id: order.id },
        orderBy: { created_at: 'asc' },
      }),
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
      bookkeepingDetails: bookkeepingDetails[0] || null,
      events: events.map(e => ({
        eventType: e.eventType,
        eventName: e.eventName,
        createdAt: e.createdAt?.toISOString(),
      })),
      // 供应链视图：派单链/履约记录
      fulfillments: fulfillments.map(f => ({
        id: f.id,
        fulfillmentNo: f.fulfillment_no,
        supplierId: f.supplier_id,
        supplierName: f.supplier_name,
        status: f.status,
        assignedAt: f.assigned_at?.toISOString(),
        acceptedAt: f.accepted_at?.toISOString(),
        startedAt: f.started_at?.toISOString(),
        completedAt: f.completed_at?.toISOString(),
        cancelledAt: f.cancelled_at?.toISOString(),
        cancelReason: f.cancel_reason,
        remark: f.remark,
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

    await this.prisma.$transaction([
      this.prisma.sealOrderDetails.create({
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
      }),
      this.prisma.orderEvents.create({
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
      }),
    ]);

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
        address_snapshot: this.parseAddressSnapshot(data.addressSnapshot || data.addressJson),
      },
    });

    await this.prisma.$transaction([
      this.prisma.newspaperOrderDetails.create({
        data: {
          orderId: order.id,
          newspaperId: data.newspaperId || null,
          newspaperName: data.newspaperName,
          newspaperCode: data.newspaperCode,
          templateId: data.templateId || null,
          templateType: data.templateType,
          content: data.content,
          contentCharCount: data.contentCharCount,
          copies: data.copies || 1,
          publicationDate: data.publicationDate ? new Date(data.publicationDate) : null,
          publicationEdition: data.publicationEdition,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      this.prisma.orderEvents.create({
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
      }),
    ]);

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

    await this.prisma.$transaction([
      this.prisma.bookkeepingOrderDetails.create({
        data: {
          orderId: order.id,
          packageId: data.packageId || null,
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
      }),
      this.prisma.orderEvents.create({
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
      }),
    ]);

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

    // 微信 JSAPI 统一下单（V3）
    // 配置齐全 → 真实下单；配置缺失 → 降级返回占位参数（开发模式）
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    const openid = user?.openid || '';

    let prepayResult: Awaited<ReturnType<typeof this.wechatPay.createJsapiOrder>> = null;
    try {
      prepayResult = await this.wechatPay.createJsapiOrder({
        description: `蓉城企服-${order.module === 'seal' ? '刻章' : order.module === 'newspaper' ? '登报' : '记账'}-${order.order_no}`,
        outTradeNo: pay.payment_no,
        amountYuan: Number(pay.amount),
        openid,
        attach: JSON.stringify({ orderNo: order.order_no, orderId: order.id }),
      });
    } catch (e: any) {
      // 微信下单失败：记录但不阻塞，返回占位参数便于开发环境联调
      console.error(`[wechat-pay] 统一下单失败 order_no=${order.order_no}:`, e?.message || e);
    }

    if (prepayResult) {
      // 回写 prepay_id / nonce_str / payment_params
      await this.prisma.payment_orders.update({
        where: { id: pay.id },
        data: {
          prepay_id: prepayResult.prepayId,
          nonce_str: prepayResult.nonceStr,
          payment_params: prepayResult as any,
        },
      });
      return {
        paymentNo: pay.payment_no,
        params: {
          appId: prepayResult.appId,
          timeStamp: prepayResult.timeStamp,
          nonceStr: prepayResult.nonceStr,
          package: prepayResult.package,
          signType: 'RSA',
          paySign: prepayResult.paySign,
        },
      };
    }

    // 降级：返回占位参数（开发模式/配置缺失）
    return {
      paymentNo: pay.payment_no,
      params: {
        appId: this.wechatPay.isConfigured() ? '' : '',
        timeStamp: '',
        nonceStr: '',
        package: '',
        signType: 'RSA',
        paySign: '',
      },
      devMode: true,
    };
  }

  /**
   * 微信支付成功回调（幂等）
   * 微信服务器调用，免鉴权
   * 双保险：payment_orders.payment_no 唯一 + payment_transactions.provider_txn_id 唯一
   */
  async notifyPayment(payload: any) {
    // 兼容两种回调格式：
    // 1. V2/XML 解析后的 JSON：{ out_trade_no, transaction_id, total_fee, return_code, result_code }
    // 2. V3 回调：{ resource: { ciphertext, nonce, associated_data } } → 解密后得到业务字段
    let body = payload || {};

    // V3 格式：解密 resource
    if (payload?.resource?.ciphertext) {
      try {
        const decrypted = this.wechatPay.decryptResource(payload.resource);
        body = decrypted;
      } catch (e: any) {
        return { success: false, message: `解密失败: ${e?.message || e}` };
      }
    }

    // 从解密后 body 提取字段（V3: out_trade_no/transaction_id/trade_state/amount.total 单位分）
    const paymentNo = body.out_trade_no;
    const providerTxnId = body.transaction_id;
    // V3: amount.total 单位分；V2: total_fee 单位分
    const feeFen =
      body.amount?.total != null
        ? Number(body.amount.total)
        : body.total != null
          ? Number(body.total)
          : body.total_fee != null
            ? Number(body.total_fee)
            : null;
    const tradeState = body.trade_state || body.result_code;
    const returnCode = body.return_code;

    if (!paymentNo || !providerTxnId) {
      return { success: false, message: '参数缺失' };
    }
    if ((returnCode && returnCode !== 'SUCCESS') || (tradeState && tradeState !== 'SUCCESS')) {
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

    // 金额校验（单位分，转元）
    const feeYuan = feeFen != null ? feeFen / 100 : null;
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
    // 兼容 V2/XML JSON 与 V3 回调（V3: resource 密文需解密）
    let body = payload || {};
    if (payload?.resource?.ciphertext) {
      try {
        body = this.wechatPay.decryptResource(payload.resource);
      } catch (e: any) {
        return { success: false, message: `解密失败: ${e?.message || e}` };
      }
    }

    // V3 解密后：{ out_refund_no, refund_status, success_time, refund_id, amount:{refund,total}, ... }
    // V2: { out_refund_no, refund_status, success_time, refund_id }
    const { out_refund_no: refundNo, refund_status, success_time } = body || {};
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
        data: { status: 'completed', refund_txn_id: body.refund_id, refund_at: success_time ? new Date(success_time) : now },
      });
      // 同步订单退款状态
      await this.prisma.orders.update({
        where: { id: refund.order_id },
        data: {
          refund_status: refund.refund_type === 'partial' ? 'partial_refund' : 'full_refund',
          payment_status: refund.refund_type === 'partial' ? 'partial_refund' : 'full_refund',
        },
      });
      return { success: true };
    }

    return { success: false, message: '退款未成功' };
  }

  /**
   * 用户申请退款
   * POST /api/v2/user/orders/:orderNo/refund
   */
  async applyRefund(orderNo: string, userId: string, data: { refundType?: string; refundAmount?: number; reason?: string }) {
    const order = await this.prisma.orders.findUnique({ where: { order_no: orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== userId) throw new BadRequestException('无权操作此订单');
    if (order.payment_status !== 'paid') throw new BadRequestException('仅已支付订单可申请退款');
    if (order.refund_status === 'full_refund' || order.refund_status === 'applying') {
      throw new BadRequestException('该订单已申请退款或已全额退款');
    }

    const refundType = data.refundType || 'full';
    const refundAmount = refundType === 'full' ? Number(order.paid_amount ?? order.pay_amount ?? 0) : (data.refundAmount ?? 0);
    if (refundAmount <= 0) throw new BadRequestException('退款金额不合法');

    const refund = await this.prisma.refund_orders.create({
      data: {
        refund_no: `RF${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        order_id: order.id,
        payment_id: undefined,
        refund_type: refundType,
        refund_amount: refundAmount,
        refund_reason: data.reason,
        status: 'applying',
        applied_by: userId,
        applied_at: new Date(),
      },
    });

    // 订单退款状态 → applying
    await this.prisma.orders.update({
      where: { id: order.id },
      data: { refund_status: 'applying' },
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: order.id,
        eventType: 'REFUND_APPLIED',
        eventName: '用户申请退款',
        fromStatus: order.refund_status,
        toStatus: 'applying',
        operatorType: 'user',
        operatorId: userId,
        metadata: { refundNo: refund.refund_no, refundAmount },
        createdAt: new Date(),
      },
    });

    return { refundNo: refund.refund_no, refundAmount, status: 'applying' };
  }

  /**
   * 管理端订单列表（全量筛选）
   * 支持 orderStatus / module / keyword 过滤
   */
  async listOrders(options: { orderStatus?: string; module?: string; keyword?: string; page?: number; pageSize?: number }) {
    const { orderStatus, module, keyword, page = 1, pageSize = 20 } = options;
    const where: any = { deleted_at: null };
    if (orderStatus) where.order_status = orderStatus;
    if (module) where.module = module;
    if (keyword) {
      where.OR = [
        { order_no: { contains: keyword } },
        { customer_remark: { contains: keyword } },
      ];
    }
    const [list, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.orders.count({ where }),
    ]);
    return {
      list: list.map(o => ({
        id: o.id,
        orderNo: o.order_no,
        userId: o.user_id,
        module: o.module,
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        fulfillmentStatus: o.fulfillment_status,
        refundStatus: o.refund_status,
        invoiceStatus: o.invoice_status,
        totalAmount: o.total_amount?.toString(),
        discountAmount: o.discount_amount?.toString(),
        payAmount: o.pay_amount?.toString(),
        refundAmount: o.refund_amount?.toString(),
        paidAmount: o.paid_amount?.toString(),
        customerRemark: o.customer_remark,
        createdAt: o.created_at?.toISOString(),
        paidAt: o.paid_at?.toISOString(),
        completedAt: o.completed_at?.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 管理端数据看板统计
   */
  async getDashboardStats() {
    const base = { deleted_at: null };
    const [
      totalOrders,
      gmvAgg,
      pendingAssign,
      refunding,
      todayOrders,
      monthOrders,
      moduleOrders,
      orderStatusGroups,
    ] = await Promise.all([
      this.prisma.orders.count({ where: base }),
      this.prisma.orders.aggregate({
        where: { ...base, payment_status: { in: ['paid', 'partial_refund', 'full_refund'] } },
        _sum: { paid_amount: true },
      }),
      this.prisma.orders.count({
        where: { ...base, fulfillment_status: 'pending_assignment', payment_status: 'paid' },
      }),
      this.prisma.orders.count({
        where: { ...base, refund_status: { in: ['applying', 'partial_refund'] } },
      }),
      this.prisma.orders.count({
        where: { ...base, created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      this.prisma.orders.count({
        where: { ...base, created_at: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }),
      this.prisma.orders.groupBy({
        by: ['module'],
        where: base,
        _count: { _all: true },
      }),
      this.prisma.orders.groupBy({
        by: ['order_status'],
        where: base,
        _count: { _all: true },
      }),
    ]);

    const moduleMap: Record<string, number> = {};
    moduleOrders.forEach((m) => (moduleMap[m.module] = m._count._all));
    const statusMap: Record<string, number> = {};
    orderStatusGroups.forEach((s) => (statusMap[s.order_status] = s._count._all));

    return {
      totalOrders,
      gmv: gmvAgg._sum.paid_amount ? gmvAgg._sum.paid_amount.toString() : '0.00',
      pendingAssign,
      refunding,
      todayOrders,
      monthOrders,
      moduleMap,
      statusMap,
    };
  }

  /**
   * 管理端退款列表
   * GET /api/v2/admin/refunds
   */
  async listRefunds(options: { status?: string; page?: number; pageSize?: number }) {
    const { status, page = 1, pageSize = 20 } = options;
    const where: any = {};
    if (status) where.status = status;
    const [total, rows] = await Promise.all([
      this.prisma.refund_orders.count({ where }),
      this.prisma.refund_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    // 关联订单（orders 表，order_no/module）
    const orderIds = rows.map(r => r.order_id).filter(Boolean);
    let orderMap: Record<string, { order_no: string; module: string }> = {};
    if (orderIds.length) {
      const orders = await this.prisma.orders.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, order_no: true, module: true },
      });
      orderMap = Object.fromEntries(orders.map(o => [o.id, { order_no: o.order_no, module: o.module }]));
    }
    // camelCase 映射（对齐 V2.0 接口规范）
    const list = rows.map(r => {
      const ord = orderMap[r.order_id];
      return {
        id: r.id,
        refundNo: r.refund_no,
        orderId: r.order_id,
        orderNo: ord?.order_no || null,
        module: ord?.module || null,
        paymentId: r.payment_id,
        refundType: r.refund_type,
        amount: r.refund_amount,
        reason: r.refund_reason,
        remark: r.refund_remark,
        status: r.status,
        appliedBy: r.applied_by,
        appliedAt: r.applied_at,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
        reviewRemark: r.review_remark,
        failureReason: r.failure_reason,
        createdAt: r.created_at,
      };
    });
    return { list, total, page, pageSize };
  }

  /**
   * 管理端审核退款
   * POST /api/v2/admin/refunds/:id/approve | /reject
   */
  async reviewRefund(id: string, approve: boolean, operatorId: string, remark?: string) {
    const refund = await this.prisma.refund_orders.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException('退款单不存在');
    if (refund.status !== 'applying') throw new BadRequestException('仅待审核退款单可审核');

    const now = new Date();
    if (approve) {
      // 审核通过 → 待处理（等待微信退款回调）
      await this.prisma.refund_orders.update({
        where: { id },
        data: { status: 'processing', reviewed_by: operatorId, reviewed_at: now, review_remark: remark },
      });
    } else {
      // 驳回
      await this.prisma.refund_orders.update({
        where: { id },
        data: { status: 'rejected', reviewed_by: operatorId, reviewed_at: now, review_remark: remark, failure_reason: remark },
      });
      // 恢复订单退款状态
      const order = await this.prisma.orders.findUnique({ where: { id: refund.order_id } });
      if (order) {
        await this.prisma.orders.update({
          where: { id: order.id },
          data: { refund_status: 'none' },
        });
      }
    }

    await this.prisma.orderEvents.create({
      data: {
        orderId: refund.order_id,
        eventType: approve ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
        eventName: approve ? '退款审核通过' : '退款审核驳回',
        fromStatus: 'applying',
        toStatus: approve ? 'processing' : 'rejected',
        operatorType: 'admin',
        operatorId,
        metadata: { refundNo: refund.refund_no, remark },
        createdAt: now,
      },
    });

    return { success: true, status: approve ? 'processing' : 'rejected' };
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderNo: string, userId: string, reason?: string) {
    const order = await this.prisma.orders.findUnique({ where: { order_no: orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.user_id !== userId) throw new BadRequestException('无权操作此订单');
    if (order.order_status !== 'pending_payment') throw new BadRequestException('仅待支付订单可取消');

    await this.prisma.orders.updateMany({
      where: { id: order.id, version: order.version },
      data: { order_status: 'cancelled', cancelled_at: new Date(), version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
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
    if (!['delivering', 'signed'].includes(order.fulfillment_status)) {
      throw new BadRequestException('仅已发货/已签收订单可确认');
    }

    await this.prisma.orders.updateMany({
      where: { id: order.id, version: order.version },
      data: { order_status: 'completed', fulfillment_status: 'completed', completed_at: new Date(), version: { increment: 1 } },
    }).then((r) => {
      if (r.count === 0) throw new ConflictException('订单状态已变更，请刷新后重试');
    });

    await this.prisma.orderEvents.create({
      data: {
        orderId: order.id,
        eventType: 'ORDER_SIGNED',
        eventName: '确认收货',
        fromStatus: order.fulfillment_status,
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
