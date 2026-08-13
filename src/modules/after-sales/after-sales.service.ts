import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

/** Parse remark JSON so callers can directly access remark.afterSales */
function parseAfterSales(obj: any): any {
  if (!obj) return obj;
  const o = { ...obj };
  if (typeof o.remark === 'string') {
    try { o.remark = JSON.parse(o.remark); } catch { o.remark = {}; }
  }
  return o;
}

@Injectable()
export class AfterSalesService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderService)) private orderService: OrderService,
  ) {}

  /** User: my after-sales records (status 7/8/9) */
  async getUserAfterSales(userId: string, query: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = query;
    const where = { user_id: userId, status: { in: [7, 8, 9] } };
    const [rows, total] = await Promise.all([
      this.prisma.seal_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { nickname: true, phone: true } } },
      }),
      this.prisma.seal_orders.count({ where }),
    ]);
    return { rows: toCamelDeep(rows).map(parseAfterSales), total, page, pageSize };
  }

  /** User: after-sales detail (own records only) */
  async getUserAfterSalesDetail(userId: string, orderId: string) {
    const order = await this.prisma.seal_orders.findFirst({
      where: { id: orderId, user_id: userId, status: { in: [7, 8, 9] } },
      include: { user: { select: { nickname: true, phone: true } } },
    });
    if (!order) throw new NotFoundException('After-sales record not found');
    return parseAfterSales(toCamelDeep(order));
  }

  /** Admin: after-sales orders list (status=7) */
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

    return { rows: toCamelDeep(rows).map(parseAfterSales), total, page, pageSize };
  }

  /** Confirm refund (status=7 -> 8 refunding) */
  async confirmRefund(order_id: string, amount?: number, operatorId?: string) {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: order_id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 7) throw new BadRequestException('Only in-progress after-sales can confirm refund');

    let afterSalesReason = '';
    try {
      const r = JSON.parse(order.remark || '{}');
      afterSalesReason = r.afterSales?.reason || '';
    } catch { /* ignore */ }

    return this.orderService.refundOrder(order_id, operatorId, amount, afterSalesReason);
  }

  /** Reject after-sales (status=7 -> 5 completed, no refund) */
  async rejectAfterSales(order_id: string, reason: string, operatorId?: string) {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: order_id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 7) throw new BadRequestException('Only in-progress after-sales can be rejected');

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
      data: { status: 5, status_text: 'completed', remark },
    });
  }

  /** Admin: refund records (status 8/9) */
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

    return { rows: toCamelDeep(rows).map(parseAfterSales), total, page, pageSize };
  }
}
