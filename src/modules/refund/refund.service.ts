import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';

@Injectable()
export class RefundService {
  constructor(private prisma: PrismaService, private orderService: OrderService) {}

  async apply(orderId: string, amount?: number, reason?: string, applyBy?: string) {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (![2, 3, 4, 7].includes(order.status)) {
      throw new BadRequestException('仅已支付/制作中/已发货/售后中订单可申请退款');
    }
    const exist = await this.prisma.refund_records.findFirst({
      where: { order_id: orderId, status: { in: [1, 2] } },
    });
    if (exist) throw new BadRequestException('该订单已有进行中的退款申请');

    const refundAmount = amount ?? Number(order.total_price);
    const dt = new Date();
    const rec = await this.prisma.refund_records.create({
      data: {
        order_id: orderId,
        order_no: order.order_no,
        user_id: order.user_id,
        amount: refundAmount,
        reason: reason || null,
        status: 1,
        status_text: '申请中',
        apply_by: applyBy || null,
        created_at: dt,
        updated_at: dt,
      },
    });
    return { id: rec.id, orderNo: rec.order_no, amount: rec.amount, status: rec.status };
  }

  async list(params: { status?: number; page?: number; pageSize?: number }) {
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const where: any = {};
    if (params.status) where.status = params.status;
    const [items, total] = await Promise.all([
      this.prisma.refund_records.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.refund_records.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async review(id: string, status: 2 | 4, reviewNote?: string, reviewerId?: string) {
    const rec = await this.prisma.refund_records.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('退款记录不存在');
    if (rec.status !== 1) throw new BadRequestException('仅申请中状态可审核');
    const updateData: any = {
      status,
      status_text: status === 2 ? '已通过' : '已拒绝',
      reviewed_by: reviewerId || null,
      reviewed_at: new Date(),
      review_note: reviewNote || null,
    };
    const updated = await this.prisma.refund_records.update({ where: { id }, data: updateData });
    return { id: updated.id, status: updated.status };
  }

  async execute(id: string, operatorId?: string) {
    const rec = await this.prisma.refund_records.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('退款记录不存在');
    if (rec.status !== 2) throw new BadRequestException('仅已通过状态可执行退款');
    // 调 orderService.refundOrder 发起微信退款
    const result: any = await this.orderService.refundOrder(rec.order_id, operatorId, Number(rec.amount), rec.reason || '审核通过退款');
    const dt = new Date();
    const updated = await this.prisma.refund_records.update({
      where: { id },
      data: {
        status: 3,
        status_text: '已退款',
        refunded_at: dt,
        updated_at: dt,
      },
    });
    return { id: updated.id, status: updated.status, orderResult: result };
  }
}
