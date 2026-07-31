// @ts-nocheck
import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderService } from '../order/order.service';

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toCamelDeep(obj: any): any {
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj !== null && typeof obj === 'object') {
    if (typeof obj.toString === 'function' && !('getTime' in obj)) {
      const str = obj.toString();
      if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)]),
    );
  }
  return obj;
}

@Injectable()
export class AfterSalesService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderService)) private orderService: OrderService,
  ) {}

  /** 售后中订单列表（status=7） */
  async getAfterSalesOrders(query: {
    module?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { module, page = 1, pageSize = 20 } = query;
    const where: any = { status: 7 };
    if (module) where.module = module;

    const [rows, total] = await Promise.all([
      this.prisma.seal_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { nickname: true, phone: true } },
        },
      }),
      this.prisma.seal_orders.count({ where }),
    ]);

    return { rows: toCamelDeep(rows), total, page, pageSize };
  }

  /** 确认退款（status=7 → 8 退款中）—— 复用 OrderService 微信退款逻辑 */
  async confirmRefund(order_id: string, amount?: number, operatorId?: string) {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: order_id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 7) throw new BadRequestException('仅「售后中」订单可确认退款');

    // 从 remark.afterSales.reason 取售后申请时的原因
    let afterSalesReason = '';
    try {
      const r = JSON.parse(order.remark || '{}');
      afterSalesReason = r.afterSales?.reason || '';
    } catch { /* ignore */ }

    // 复用 OrderService.refundOrder（内部调微信退款 + 置 status=8）
    return this.orderService.refundOrder(order_id, operatorId, amount, afterSalesReason);
  }

  /** 拒绝售后（status=7 → 5 已完成，不退款） */
  async rejectAfterSales(order_id: string, reason: string, operatorId?: string) {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: order_id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 7) throw new BadRequestException('仅「售后中」订单可拒绝售后');

    let remark: string;
    try {
      const obj = JSON.parse(order.remark || '{}');
      obj.afterSalesReject = { reason, operatorId, rejectedAt: new Date().toISOString() };
      remark = JSON.stringify(obj);
    } catch {
      remark = JSON.stringify({ afterSalesReject: { reason, operatorId, rejectedAt: new Date().toISOString() } });
    }

    return this.prisma.seal_orders.update({
      where: { id: order_id },
      data: { status: 5, status_text: '已完成', remark },
    });
  }

  /** 退款记录（status=8 退款中 / 9 已退款） */
  async getRefundRecords(query: {
    module?: string;
    status?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { module, status, startDate, endDate, page = 1, pageSize = 20 } = query;
    const where: any = { status: { in: status ? [status] : [8, 9] } };
    if (module) where.module = module;
    if (startDate) where.created_at = { ...where.created_at, gte: new Date(startDate) };
    if (endDate) where.created_at = { ...where.created_at, lte: new Date(endDate + 'T23:59:59') };

    const [rows, total] = await Promise.all([
      this.prisma.seal_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { nickname: true, phone: true } },
        },
      }),
      this.prisma.seal_orders.count({ where }),
    ]);

    return { rows: toCamelDeep(rows), total, page, pageSize };
  }

}
