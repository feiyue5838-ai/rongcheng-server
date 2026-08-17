// 结算域 - SettlementRepository
// 基于 settlement_orders / settlement_items

// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/base.repository';

@Injectable()
export class SettlementRepository extends BaseRepository<any> {
  protected model = this.prisma.settlement_orders;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // 按供应商查询
  async findBySupplier(supplierId: string, options?: any) {
    return this.findMany({ supplier_id: supplierId }, options);
  }

  // 按结算单号查询
  async findBySettlementNo(settlementNo: string) {
    return this.model.findUnique({
      where: { settlement_no: settlementNo },
      include: { settlement_items: true }
    });
  }

  // 按周期查询
  async findByPeriod(supplierId: string, periodStart: Date, periodEnd: Date) {
    return this.model.findFirst({
      where: {
        supplier_id: supplierId,
        period_start: periodStart,
        period_end: periodEnd
      }
    });
  }

  // 创建结算单
  async createSettlement(data: any) {
    return this.create({
      ...data,
      settlement_no: await this.generateSettlementNo(),
      status: 1
    });
  }

  // 添加结算明细
  async addSettlementItem(settlementId: string, item: any) {
    return this.prisma.settlement_items.create({
      data: {
        settlement_id: settlementId,
        ...item
      }
    });
  }

  // 更新结算状态
  async updateStatus(id: string, status: number) {
    return this.update(id, {
      status,
      ...(status === 2 ? { confirmed_at: new Date() } : {}),
      ...(status === 3 ? { paid_at: new Date() } : {})
    });
  }

  // 生成结算单号
  private async generateSettlementNo(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.count({
      settlement_no: { startsWith: `ST${dateStr}` }
    });
    const seq = (count + 1).toString().padStart(3, '0');
    return `ST${dateStr}${seq}`;
  }
}
