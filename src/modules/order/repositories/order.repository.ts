// 订单域 - OrderRepository
// 基于 order_orders 统一订单主表

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/base.repository';

@Injectable()
export class OrderRepository extends BaseRepository<any> {
  protected model = this.prisma.order_orders;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // 按业务类型查询
  async findByBizType(bizType: string, options?: any) {
    return this.findMany({ biz_type: bizType }, options);
  }

  // 按订单号查询
  async findByOrderNo(orderNo: string) {
    return this.model.findUnique({ where: { order_no: orderNo } });
  }

  // 按用户查询
  async findByUser(userId: string, options?: any) {
    return this.findMany({ user_id: userId }, options);
  }

  // 按状态查询
  async findByStatus(status: number, options?: any) {
    return this.findMany({ status }, options);
  }

  // 带业务明细查询
  async findWithDetails(id: string) {
    return this.model.findUnique({
      where: { id },
      include: {
        user: true,
        order_items_new: true,
        order_seal_details: true,
        order_newspaper_details: true,
        order_bookkeeping_details: true,
        payment_orders: true,
        fulfillment_orders: {
          where: { is_active: true },
          orderBy: { assigned_at: 'desc' },
          take: 1
        }
      }
    });
  }

  // 更新状态
  async updateStatus(id: string, status: number, statusText?: string) {
    return this.update(id, {
      status,
      status_text: statusText,
      ...(status === 3 ? { completed_at: new Date() } : {}),
      ...(status === 6 ? { canceled_at: new Date() } : {})
    });
  }
}
