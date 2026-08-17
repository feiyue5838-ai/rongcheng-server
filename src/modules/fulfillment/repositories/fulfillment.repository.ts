// @ts-nocheck
// DEPRECATED: DDD 阶段1 旧实现，已被 V2.0 orders 统一表取代（fulfillment_orders 表已按 V2.0 重建，此文件仅保证编译兼容，随旧 API 一并下线）
// 履约域 - FulfillmentRepository
// 基于 fulfillment_orders

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/base.repository';

@Injectable()
export class FulfillmentRepository extends BaseRepository<any> {
  protected model = this.prisma.fulfillment_orders;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // 按订单查询有效履约单
  async findActiveByOrder(orderId: string) {
    return this.model.findFirst({
      where: { order_id: orderId, is_active: true },
      orderBy: { assigned_at: 'desc' }
    });
  }

  // 按供应商查询
  async findBySupplier(supplierId: string, options?: any) {
    return this.findMany({ supplier_id: supplierId }, options);
  }

  // 创建履约单
  async createFulfillment(data: any) {
    return this.create({
      ...data,
      fulfillment_no: await this.generateFulfillmentNo(),
      status: 1,
      status_text: '待接单',
      is_active: true
    });
  }

  // 取消旧履约单（支持多次派单）
  async cancelPrevious(orderId: string, reason: string) {
    const active = await this.findActiveByOrder(orderId);
    if (active) {
      return this.update(active.id, {
        is_active: false,
        status: 6,
        status_text: '已换网点',
        canceled_at: new Date(),
        cancel_reason: reason
      });
    }
    return null;
  }

  // 更新状态
  async updateStatus(id: string, status: number, statusText: string) {
    return this.update(id, {
      status,
      status_text: statusText,
      ...(status === 2 ? { accepted_at: new Date() } : {}),
      ...(status === 3 ? { completed_at: new Date() } : {})
    });
  }

  // 生成履约单号
  private async generateFulfillmentNo(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.count({
      fulfillment_no: { startsWith: `FL${dateStr}` }
    });
    const seq = (count + 1).toString().padStart(4, '0');
    return `FL${dateStr}${seq}`;
  }
}
