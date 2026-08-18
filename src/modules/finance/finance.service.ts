// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  /** 资金总览：收入/手续费/退款/网点分成/平台净利 */
  async getOverview(params: { startDate?: string; endDate?: string; days?: number }) {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (params.startDate && params.endDate) {
      start = new Date(params.startDate + ' 00:00:00');
      end = new Date(params.endDate + ' 23:59:59');
    } else if (params.days && Number(params.days) > 0) {
      start = new Date(now.getTime() - (Number(params.days) - 1) * 86400000);
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    } else {
      // 默认本月
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const whereRange: any = { created_at: { gte: start, lte: end } };

    // F-08: settleAgg 仅统计已付款(status=3)的结算单，避免「待确认」状态重复计入
    const [incomeAgg, refundAgg, byModule, settleAgg, trend] = await Promise.all([
      this.prisma.transaction_flows.aggregate({
        where: { trade_type: 'income', ...whereRange },
        _sum: { amount: true, fee: true },
        _count: true,
      }),
      this.prisma.transaction_flows.aggregate({
        where: { trade_type: 'refund', ...whereRange },
        _sum: { amount: true, fee: true },
        _count: true,
      }),
      this.prisma.$queryRaw`
        SELECT module, trade_type, business_type AS "businessType", COUNT(*)::int AS cnt, SUM(amount) AS amount
        FROM transaction_flows
        WHERE trade_type IN ('income','refund') AND created_at >= ${start} AND created_at <= ${end}
        GROUP BY module, trade_type, business_type ORDER BY amount DESC
      `,
      this.prisma.settlement_records.aggregate({
        where: { created_at: { gte: start, lte: end }, status: 'paid' }, // V2.0: 仅统计已付款结算
        _sum: { payable_amount: true, gross_amount: true },
        _count: true,
      }),
      // 生成完整日期序列（无数据的天也返回 0），避免图表柱子缺失
      this.prisma.$queryRaw`
        WITH dates AS (
          SELECT gs AS day FROM generate_series(
            ${start.toISOString()}::timestamp,
            ${end.toISOString()}::timestamp,
            '1 day'::interval
          ) AS gs
        )
        SELECT
          TO_CHAR(d.day, 'MM-DD') AS day,
          COALESCE(SUM(CASE WHEN tf.trade_type = 'income' THEN tf.amount ELSE 0 END), 0) AS income,
          COALESCE(SUM(CASE WHEN tf.trade_type = 'refund' THEN tf.amount ELSE 0 END), 0) AS refund
        FROM dates d
        LEFT JOIN transaction_flows tf ON DATE_TRUNC('day', tf.created_at) = DATE_TRUNC('day', d.day)
        GROUP BY d.day
        ORDER BY d.day
      `,
    ]);

    // 待确认结算（status=pending）单独展示
    const pendingAgg = await this.prisma.settlement_records.aggregate({
      where: { status: 'pending' },
      _sum: { payable_amount: true, gross_amount: true },
      _count: true,
    });

    const income = Number(incomeAgg._sum.amount || 0);
    const incomeFee = Number(incomeAgg._sum.fee || 0);
    const incomeCount = incomeAgg._count;
    const refund = Number(refundAgg._sum.amount || 0);
    // refundAgg._sum.fee（退款手续费）：退款交易通常免手续费，当前为0，保留供未来扩展
    const refundCount = refundAgg._count;
    const outletSettle = Number(settleAgg._sum.payable_amount || 0);
    const platformSettle = Number(settleAgg._sum.gross_amount || 0);
    const settleCount = settleAgg._count;
    const pendingOutlet = Number(pendingAgg._sum.payable_amount || 0);
    const pendingCount = pendingAgg._count;

    const netIncome = Math.round((income - incomeFee - refund) * 100) / 100; // 资金净流入（未扣分成）
    // F-08: 平台净利公式修正
    // 原公式误减了 platformSettle（平台自己的分成额），造成重复扣减
    // 正确逻辑：收入 - 手续费 - 退款 - 已付网点分成 = 平台净利
    const platformNet = Math.round((income - incomeFee - refund - outletSettle) * 100) / 100;

    const norm = (v: any) => (v === null || v === undefined ? 0 : Number(v));

    return {
      range: { start: start.toISOString(), end: end.toISOString() },
      income,
      incomeFee,
      incomeCount,
      refund,
      refundCount,
      netIncome,
      outletSettle,
      platformSettle,
      settleCount,
      pendingOutlet,
      pendingCount,
      platformNet,
      byModule: ((byModule as any[]) || []).map((m: any) => ({
        module: m.module,
        tradeType: m.trade_type,
        businessType: m.businessType,
        count: norm(m.cnt),
        amount: norm(m.amount),
      })),
      trend: ((trend as any[]) || []).map((t: any) => ({
        day: t.day,
        income: norm(t.income),
        refund: norm(t.refund),
      })),
    };
  }
}
