// @ts-nocheck
// 支付域 - PaymentRepository
// 基于 payment_orders / payment_transactions（DDD 废弃路径，表已按 V2.0 重建，仅编译兼容）

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/base.repository';

@Injectable()
export class PaymentRepository extends BaseRepository<any> {
  protected model = this.prisma.payment_orders;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // 按订单查询支付单
  async findByOrder(orderId: string) {
    return this.findMany({ order_id: orderId });
  }

  // 按用户查询支付单
  async findByUser(userId: string, options?: any) {
    return this.findMany({ user_id: userId }, options);
  }

  // 按支付单号查询
  async findByPaymentNo(paymentNo: string) {
    return this.model.findUnique({ where: { payment_no: paymentNo } });
  }

  // 创建支付单（带事务）
  async createPayment(data: any, transaction?: string) {
    const payment = await this.create(data);
    if (transaction) {
      await this.prisma.payment_transactions.create({
        data: {
          payment_id: payment.id,
          transaction_no: transaction,
          amount: data.amount,
          type: 'payment',
          method: data.pay_method,
          status: 1
        }
      });
    }
    return payment;
  }

  // 更新支付状态
  async updatePaymentStatus(id: string, status: number, paidAmount?: number, transactionId?: string) {
    return this.update(id, {
      status,
      paid_amount: paidAmount,
      transaction_id: transactionId,
      ...(status === 2 ? { paid_at: new Date() } : {})
    });
  }
}
