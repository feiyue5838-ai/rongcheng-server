import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateTransactionNo } from '../../common/utils/sn';

function toCamelDeep(obj: any): any {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  // Prisma Decimal 优先（typeof === 'object'）
  if (typeof obj === 'object' && 's' in obj && 'e' in obj && 'd' in obj) {
    return Number(obj);
  }
  // Date 对象直接转 ISO 字符串（避免被递归成空对象）
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    const camelEntries = entries.map(([k, v]) => {
      const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      return [camelKey, toCamelDeep(v)];
    });
    return Object.fromEntries(camelEntries);
  }
  return obj;
}

function formatDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  /** 生成交易单号 */
  private generateTransactionNo(): string {
    return generateTransactionNo();
  }

  /** 写入交易流水 */
  async createFlow(data: {
    orderId?: string;
    orderNo?: string;
    module: string;
    businessType: string;
    tradeType: string;
    userId?: string;
    userName?: string;
    userPhone?: string;
    outletId?: string;
    outletName?: string;
    amount: number;
    fee?: number;
    payMethod?: string;
    status?: string;
    statusText?: string;
    transactionId?: string;
    remark?: string;
  }) {
    const fee = data.fee || 0;
    const netAmount = Number(data.amount) - fee;
    return this.prisma.transaction_flows.create({
      data: {
        transaction_no: this.generateTransactionNo(),
        order_id: data.orderId || null,
        order_no: data.orderNo || null,
        module: data.module,
        business_type: data.businessType,
        trade_type: data.tradeType,
        user_id: data.userId || null,
        user_name: data.userName || null,
        user_phone: data.userPhone || null,
        outlet_id: data.outletId || null,
        outlet_name: data.outletName || null,
        amount: data.amount,
        fee: fee,
        net_amount: netAmount,
        pay_method: data.payMethod || null,
        status: data.status || 'success',
        status_text: data.statusText || '交易成功',
        transaction_id: data.transactionId || null,
        remark: data.remark || null,
      },
    });
  }

  /** 交易流水列表（分页+筛选） */
  async getFlows(params: {
    page?: number;
    pageSize?: number;
    module?: string;
    tradeType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
    outletId?: string;
  }) {
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.module) where.module = params.module;
    if (params.tradeType) where.trade_type = params.tradeType;
    if (params.status) where.status = params.status;
    if (params.outletId) where.outlet_id = params.outletId;
    if (params.startDate || params.endDate) {
      where.created_at = {};
      if (params.startDate) where.created_at.gte = new Date(params.startDate + ' 00:00:00');
      if (params.endDate) where.created_at.lte = new Date(params.endDate + ' 23:59:59');
    }
    if (params.keyword) {
      where.OR = [
        { transaction_no: { contains: params.keyword, mode: 'insensitive' } },
        { order_no: { contains: params.keyword, mode: 'insensitive' } },
        { user_name: { contains: params.keyword, mode: 'insensitive' } },
        { user_phone: { contains: params.keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.transaction_flows.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.transaction_flows.count({ where }),
    ]);

    return {
      items: toCamelDeep(items),
      total,
      page,
      pageSize,
    };
  }

  /** 交易统计 */
  async getStats(params: {
    startDate?: string;
    endDate?: string;
  }) {
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    const firstOfMonth = formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    // 通用日期条件
    const buildDateWhere = (start, end) => {
      const where: any = { status: 'success' };
      if (start) where.created_at = { ...(where.created_at || {}), gte: new Date(start + ' 00:00:00') };
      if (end) where.created_at = { ...(where.created_at || {}), lte: new Date(end + ' 23:59:59') };
      return where;
    };

    // 今日收入
    const todayIncome = await this.prisma.transaction_flows.aggregate({
      where: { ...buildDateWhere(today, today), trade_type: 'income' },
      _sum: { amount: true, fee: true, net_amount: true },
      _count: true,
    });

    // 今日退款
    const todayRefund = await this.prisma.transaction_flows.aggregate({
      where: { ...buildDateWhere(today, today), trade_type: 'refund' },
      _sum: { amount: true },
      _count: true,
    });

    // 昨日对比
    const yesterdayIncome = await this.prisma.transaction_flows.aggregate({
      where: { ...buildDateWhere(yesterday, yesterday), trade_type: 'income' },
      _sum: { amount: true },
    });

    const yesterdayRefund = await this.prisma.transaction_flows.aggregate({
      where: { ...buildDateWhere(yesterday, yesterday), trade_type: 'refund' },
      _sum: { amount: true },
    });

    // 本月累计
    const monthIncome = await this.prisma.transaction_flows.aggregate({
      where: { ...buildDateWhere(firstOfMonth, today), trade_type: 'income' },
      _sum: { amount: true, fee: true, net_amount: true },
      _count: true,
    });

    // 本月退款
    const monthRefund = await this.prisma.transaction_flows.aggregate({
      where: { ...buildDateWhere(firstOfMonth, today), trade_type: 'refund' },
      _sum: { amount: true },
      _count: true,
    });

    const calcTrend = (today, yesterday) => {
      if (!yesterday || Number(yesterday) === 0) return null;
      return ((Number(today) - Number(yesterday)) / Number(yesterday) * 100).toFixed(1);
    };

    return {
      today: {
        income: Number(todayIncome._sum.amount || 0),
        refund: Number(todayRefund._sum.amount || 0),
        net: Number(todayIncome._sum.net_amount || 0) - Number(todayRefund._sum.amount || 0),
        count: todayIncome._count || 0,
        incomeTrend: calcTrend(todayIncome._sum.amount, yesterdayIncome._sum.amount),
        refundTrend: calcTrend(todayRefund._sum.amount, yesterdayRefund._sum.amount),
      },
      month: {
        income: Number(monthIncome._sum.amount || 0),
        refund: Number(monthRefund._sum.amount || 0),
        net: Number(monthIncome._sum.net_amount || 0) - Number(monthRefund._sum.amount || 0),
        count: monthIncome._count || 0,
      },
    };
  }

  /** 按业务类型统计 */
  async getStatsByModule(params: {
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = { status: 'success', trade_type: 'income' };
    if (params.startDate) where.created_at = { ...where.created_at, gte: new Date(params.startDate + ' 00:00:00') };
    if (params.endDate) where.created_at = { ...where.created_at, lte: new Date(params.endDate + ' 23:59:59') };

    const raw = await this.prisma.$queryRaw`
      SELECT module, business_type,
             COUNT(*) as count,
             SUM(amount) as total_amount,
             SUM(fee) as total_fee,
             SUM(net_amount) as total_net
      FROM transaction_flows
      WHERE ${where.status || 'success'} = 'success'
        AND trade_type = 'income'
        AND (${params.startDate || ''} = '' OR created_at >= ${params.startDate || '1970-01-01'}::timestamp)
        AND (${params.endDate || ''} = '' OR created_at <= (${params.endDate || '2099-12-31'}::date + interval '1 day'))
      GROUP BY module, business_type
      ORDER BY total_amount DESC
    `;
    return toCamelDeep(raw);
  }

  /** 导出交易流水 */
  async exportFlows(params: {
    startDate?: string;
    endDate?: string;
    module?: string;
    tradeType?: string;
    status?: string;
    keyword?: string;
    outletId?: string;
  }) {
    const data = await this.getFlows({ ...params, page: 1, pageSize: 10000 });
    return data.items;
  }

  /** 获取单条流水详情 */
  async getFlowById(id: string) {
    const item = await this.prisma.transaction_flows.findUnique({ where: { id } });
    return toCamelDeep(item);
  }

  /** 获取有流水的服务商列表（用于筛选下拉） */
  async getOutletsWithFlows() {
    const rows = await this.prisma.$queryRaw`
      SELECT DISTINCT outlet_id, outlet_name
      FROM transaction_flows
      WHERE outlet_id IS NOT NULL AND outlet_name IS NOT NULL
      ORDER BY outlet_name
    `;
    return (rows as any[]).map(r => ({
      outletId: r.outlet_id,
      outletName: r.outlet_name,
    }));
  }
}
