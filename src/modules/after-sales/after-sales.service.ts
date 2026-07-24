import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AfterSalesService {
  constructor(private prisma: PrismaService) {}

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
      this.prisma.sealOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { nickname: true, phone: true } },
        },
      }),
      this.prisma.sealOrder.count({ where }),
    ]);

    return { rows, total, page, pageSize };
  }

  /** 确认退款（status=7 → 8 退款中） */
  async confirmRefund(orderId: string, operatorId?: string) {
    const order = await this.prisma.sealOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 7) throw new BadRequestException('仅「售后中」订单可确认退款');

    const totalFee = Math.round(Number(order.totalPrice) * 100);
    // mock 退款 ID（真实环境替换为微信退款调用）
    const refundId = `mock_refund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const remark = JSON.stringify({
      ...JSON.parse(order.remark || '{}'),
      refund: { refundId, refundFee: totalFee, operatorId, refundedAt: new Date().toISOString() },
    });

    return this.prisma.sealOrder.update({
      where: { id: orderId },
      data: { status: 8, statusText: '退款中', remark },
    });
  }

  /** 拒绝售后（status=7 → 5 已完成，不退款） */
  async rejectAfterSales(orderId: string, reason: string, operatorId?: string) {
    const order = await this.prisma.sealOrder.findUnique({ where: { id: orderId } });
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

    return this.prisma.sealOrder.update({
      where: { id: orderId },
      data: { status: 5, statusText: '已完成', remark },
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
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate + 'T23:59:59') };

    const [rows, total] = await Promise.all([
      this.prisma.sealOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { nickname: true, phone: true } },
        },
      }),
      this.prisma.sealOrder.count({ where }),
    ]);

    return { rows, total, page, pageSize };
  }

}
