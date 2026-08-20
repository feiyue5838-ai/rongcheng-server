// V2.0 结算服务
// 基于 settlement_records / settlement_items / supplier_payouts（V2.0 结构）

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SettlementV2Service {
  constructor(private readonly prisma: PrismaService) {}

  private toSettlementDto(record: any) {
    return {
      id: record.id,
      settlementNo: record.settlement_no,
      supplierId: record.supplier_id,
      supplierName: record.supplier_name,
      supplierNo: record.supplier_no,
      periodStart: record.period_start,
      periodEnd: record.period_end,
      grossAmount: Number(record.gross_amount || 0),
      totalAmount: Number(record.gross_amount || 0),
      refundAmount: Number(record.refund_amount || 0),
      adjustmentAmount: Number(record.adjustment_amount || 0),
      penaltyAmount: Number(record.penalty_amount || 0),
      payableAmount: Number(record.payable_amount || 0),
      orderCount: record._count?.settlement_items,
      status: record.status,
      confirmedBy: record.confirmed_by,
      confirmedAt: record.confirmed_at,
      confirmRemark: record.confirm_remark,
      paidBy: record.paid_by,
      paidAt: record.paid_at,
      paymentMethod: record.payment_method,
      transactionNo: record.transaction_no,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private toSettlementItemDto(item: any) {
    return {
      id: item.id,
      settlementId: item.settlement_id,
      orderId: item.order_id,
      orderNo: item.order_no,
      fulfillmentOrderId: item.fulfillment_order_id,
      module: item.module,
      orderAmount: Number(item.order_amount || 0),
      supplierCost: Number(item.supplier_cost || 0),
      refundDeduct: Number(item.refund_deduct || 0),
      adjustmentAmount: Number(item.adjustment_amount || 0),
      payableAmount: Number(item.payable_amount || 0),
      amount: Number(item.payable_amount || 0),
      ruleId: item.rule_id,
      ruleVersion: item.rule_version,
      remark: item.remark,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  private async generateSettlementNo(): Promise<string> {
    return `ST${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  private async generatePayoutNo(): Promise<string> {
    return `PO${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  /**
   * 结算单列表（管理端）
   */
  async listSettlements(options: { page?: number; pageSize?: number; status?: string; supplierId?: string }) {
    const { page = 1, pageSize = 20, status, supplierId } = options;
    const where: any = {};
    if (status) where.status = status;
    if (supplierId) where.supplier_id = supplierId;

    const [total, rows] = await Promise.all([
      this.prisma.settlement_records.count({ where }),
      this.prisma.settlement_records.findMany({
        where,
        include: { _count: { select: { settlement_items: true } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { list: rows.map((row) => this.toSettlementDto(row)), total, page, pageSize };
  }

  /**
   * 结算单明细（管理端/供应商端共用）
   */
  async getSettlementDetail(id: string, supplierId?: string) {
    const record = await this.prisma.settlement_records.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('结算单不存在');
    if (supplierId && record.supplier_id !== supplierId) {
      throw new BadRequestException('无权查看此结算单');
    }
    const items = await this.prisma.settlement_items.findMany({
      where: { settlement_id: id },
      orderBy: { created_at: 'asc' },
    });
    return {
      ...this.toSettlementDto(record),
      orderCount: items.length,
      items: items.map((item) => this.toSettlementItemDto(item)),
    };
  }

  /**
   * 生成结算单（财务/管理员）
   * 汇总指定供应商周期内已完成履约的订单
   */
  async generateSettlement(data: { supplierId: string; periodStart: string; periodEnd: string; operatorId?: string }) {
    const { supplierId, periodStart, periodEnd } = data;

    // 校验供应商
    const supplier = await this.prisma.suppliers.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('供应商不存在');
    if (supplier.status !== 1) throw new BadRequestException('供应商已停用');

    const start = new Date(`${periodStart}T00:00:00.000Z`);
    const end = new Date(`${periodEnd}T00:00:00.000Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('结算周期不合法');
    }
    const endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    // 查周期内已完成履约的订单（fulfillment_orders status=completed，关联 orders）
    const fulfillments = await this.prisma.fulfillment_orders.findMany({
      where: {
        supplier_id: supplierId,
        status: 'completed',
        completed_at: { gte: start, lt: endExclusive },
      },
      orderBy: { completed_at: 'asc' },
    });

    if (!fulfillments.length) {
      throw new BadRequestException('该周期内无已完成订单');
    }

    // 排除已进入有效结算单的履约单，避免重叠周期重复结算
    const settledItems = await this.prisma.settlement_items.findMany({
      where: {
        fulfillment_order_id: { in: fulfillments.map((f) => f.id) },
        settlement: { status: { not: 'cancelled' } },
      },
      select: { fulfillment_order_id: true },
    });
    const settledFulfillmentIds = new Set(settledItems.map((item) => item.fulfillment_order_id));
    const eligibleFulfillments = fulfillments.filter((item) => !settledFulfillmentIds.has(item.id));
    if (!eligibleFulfillments.length) {
      throw new BadRequestException('该周期内订单均已生成结算单');
    }

    // 按订单汇总
    const orderNos = eligibleFulfillments.map((f) => f.order_no);
    const orders = await this.prisma.orders.findMany({
      where: { order_no: { in: orderNos } },
    });
    const orderMap = new Map(orders.map((o) => [o.order_no, o]));

    // 计算金额（供应商成本 = 订单实付金额，简化：无成本配置时用订单金额）
    let grossAmount = 0;
    const items: {
      order_id: string;
      order_no: string;
      fulfillment_order_id: string;
      module: string;
      order_amount: number;
      supplier_cost: number;
      refund_deduct: number;
      adjustment_amount: number;
      payable_amount: number;
    }[] = [];
    for (const f of eligibleFulfillments) {
      const order = orderMap.get(f.order_no);
      if (!order) continue;
      const orderAmount = Number(order.paid_amount ?? order.pay_amount ?? order.total_amount ?? 0);
      grossAmount += orderAmount;
      items.push({
        order_id: order.id,
        order_no: order.order_no,
        fulfillment_order_id: f.id,
        module: order.module,
        order_amount: orderAmount,
        supplier_cost: orderAmount,
        refund_deduct: 0,
        adjustment_amount: 0,
        payable_amount: orderAmount,
      });
    }

    if (!items.length) throw new BadRequestException('无有效结算订单');

    // 建结算单 + 明细（事务）
    const settlementNo = await this.generateSettlementNo();
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.settlement_records.create({
        data: {
          settlement_no: settlementNo,
          supplier_id: supplierId,
          supplier_name: supplier.name,
          period_start: start,
          period_end: end,
          gross_amount: grossAmount,
          payable_amount: grossAmount,
          status: 'pending',
        },
      });
      await tx.settlement_items.createMany({
        data: items.map((i) => ({ ...i, settlement_id: created.id })),
      });
      return created;
    });

    return {
      settlementNo,
      id: record.id,
      supplierId,
      supplierName: supplier.name,
      periodStart,
      periodEnd,
      grossAmount,
      payableAmount: grossAmount,
      orderCount: items.length,
      status: 'pending',
    };
  }

  /**
   * 确认结算单（运营）
   */
  async confirmSettlement(id: string, operatorId: string, remark?: string) {
    const record = await this.prisma.settlement_records.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('结算单不存在');
    if (record.status !== 'pending') throw new BadRequestException('仅待确认结算单可确认');

    await this.prisma.settlement_records.update({
      where: { id },
      data: { status: 'confirmed', confirmed_by: operatorId, confirmed_at: new Date(), confirm_remark: remark },
    });
    return { success: true };
  }

  /**
   * 结算单付款（财务）
   * 创建 supplier_payouts(paid) + 结算单 status=paid
   */
  async paySettlement(id: string, data: { operatorId?: string; paymentMethod?: string; transactionNo?: string; bankName?: string; bankAccountName?: string; bankAccountNo?: string }) {
    const record = await this.prisma.settlement_records.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('结算单不存在');
    if (record.status === 'paid') throw new BadRequestException('结算已付款，不可重复付款');
    if (record.status !== 'confirmed') throw new BadRequestException('结算单未确认，不可付款');

    const paymentMethod = data.paymentMethod || 'bank_transfer';
    const now = new Date();
    let payoutNo = '';

    await this.prisma.$transaction(async (tx) => {
      payoutNo = await this.generatePayoutNo();
      // 创建付款单
      await tx.supplierPayouts.create({
        data: {
          payoutNo,
          supplierId: record.supplier_id,
          supplierName: record.supplier_name,
          settlementId: record.id,
          amount: Number(record.payable_amount),
          bankName: data.bankName,
          bankAccountName: data.bankAccountName,
          bankAccountNo: data.bankAccountNo,
          paymentMethod: paymentMethod,
          status: 'paid',
          requestedBy: data.operatorId,
          requestedAt: now,
          approvedBy: data.operatorId,
          approvedAt: now,
          paidBy: data.operatorId,
          paidAt: now,
          transactionNo: data.transactionNo,
          createdAt: now,
          updatedAt: now,
        },
      });
      // 更新结算单
      await tx.settlement_records.update({
        where: { id },
        data: { status: 'paid', paid_by: data.operatorId, paid_at: now, payment_method: paymentMethod, transaction_no: data.transactionNo },
      });
    });

    return { success: true, payoutNo };
  }

  /**
   * 供应商结算列表
   */
  async getSupplierSettlements(supplierId: string, options: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = options;
    const where = { supplier_id: supplierId };
    const [total, rows] = await Promise.all([
      this.prisma.settlement_records.count({ where }),
      this.prisma.settlement_records.findMany({
        where,
        include: { _count: { select: { settlement_items: true } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { list: rows.map((row) => this.toSettlementDto(row)), total, page, pageSize };
  }

  /**
   * 供应商结算明细（含逐订单）
   */
  async getSupplierSettlementDetail(id: string, supplierId: string) {
    const record = await this.prisma.settlement_records.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('结算单不存在');
    if (record.supplier_id !== supplierId) throw new BadRequestException('无权查看此结算单');
    const items = await this.prisma.settlement_items.findMany({
      where: { settlement_id: id },
      orderBy: { created_at: 'asc' },
    });
    return {
      ...this.toSettlementDto(record),
      orderCount: items.length,
      items: items.map((item) => this.toSettlementItemDto(item)),
    };
  }
}
