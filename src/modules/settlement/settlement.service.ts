// @ts-nocheck
﻿import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toCamelDeep } from '../../common/utils/case';



@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  // ==================== 结算规则 ====================

  /** 获取结算规则列表（可选按网点或模块过滤），含网点名称 */
  async getRules(filters?: { outletId?: string; module?: string }) {
    // V2.0 表重建后 settlement_rules 已废弃，返回空数组（旧前端期望数组）
    return [];
  }
    async getDefaultRule() {
    // V2.0 表重建后 settlement_rules 已废弃，返回 null
    return null;
  }

  /**
   * 三级规则查找：网点+模块专属 > 网点专属 > 模块专属 > 全局默认
   * F-02: 过滤规则有效期（valid_from / valid_to）
   */
    async findApplicableRule(outletId: string, module: string) {
    // V2.0 settlement_rules 已废弃
    return null;
  }

  /**
   * 带时间戳验证的规则查找（内部方法）
   */
    async findApplicableRuleWithValidation(outletId: string, module: string, now: Date) {
    // V2.0 settlement_rules 已废弃
    return null;
  }

  /**
   * 根据规则计算网点分成和平台分成
   * F-02: 增加边界约束，防止负数分成
   */
  applyRule(orderAmount: number, orderCount: number, rule: any) {
    let outletAmount: number;
    if (rule.type === 'fixed') {
      // F-02: 固定金额不能为负，且总额不能超过订单金额
      const fixed = Math.max(0, Number(rule.fixed_amount || 0));
      outletAmount = orderCount * fixed;
    } else {
      // F-02: 百分比必须在 0~100 之间，且结果取整到分
      const percent = Number(rule.percent || 0);
      if (percent < 0 || percent > 100) {
        throw new BadRequestException('分成比例必须在 0~100% 之间');
      }
      outletAmount = Math.round(orderAmount * (percent / 100) * 100) / 100;
    }
    // F-02: 网点分成不能超过订单总额（防止负数平台净利）
    outletAmount = Math.min(Math.round(outletAmount * 100) / 100, orderAmount);
    const platformAmount = Math.round((orderAmount - outletAmount) * 100) / 100;
    return { outletAmount, platformAmount };
  }

  /** 创建结算规则 */
    async createRule(data: any, userId?: string) {
    // V2.0 表重建后 settlement_rules 已废弃
    throw new BadRequestException('结算规则功能已废弃，V2.0 使用固定结算比例');
  }

  /** 更新结算规则 */
    async updateRule(id: string, data: any, userId?: string) {
    // V2.0 表重建后 settlement_rules 已废弃
    throw new BadRequestException('结算规则功能已废弃，V2.0 使用固定结算比例');
  }

  /** 删除结算规则 */
    async deleteRule(id: string) {
    // V2.0 表重建后 settlement_rules 已废弃
    throw new BadRequestException('结算规则功能已废弃，V2.0 使用固定结算比例');
  }

  // ==================== 结算记录 ====================

  /** 获取结算记录列表 */
  async getRecords(params: {
    page?: number;
    pageSize?: number;
    outletId?: string;
    status?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, pageSize = 20, outletId, status, startDate, endDate } = params;
    const where: any = {};

    if (outletId) where.supplier_id = outletId; // V2.0: outlets.id === suppliers.id
    // V1 数字状态 → V2.0 字符串状态映射（1=待确认 pending / 2=已确认 confirmed / 3=已付款 paid）
    const STATUS_MAP: Record<number, string> = { 1: 'pending', 2: 'confirmed', 3: 'paid' };
    const s = status !== undefined && status !== null ? Number(status) : NaN;
    if (!Number.isNaN(s)) where.status = STATUS_MAP[s] ?? String(s);
    if (startDate || endDate) {
      where.period_start = {};
      if (startDate) where.period_start.gte = new Date(startDate);
      if (endDate) where.period_end = { lte: new Date(endDate + 'T23:59:59') };
    }

    const [records, total, summary] = await Promise.all([
      this.prisma.settlement_records.findMany({
        where,

        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.settlement_records.count({ where }),
      this.prisma.settlement_records.aggregate({
        where,

        _count: true,
      }),
    ]);

    return {
      items: toCamelDeep(records),
      total,
      page,
      pageSize,
      summary: {
        totalCount: summary._count || 0,
      },
    };
  }

  /** 获取单个结算记录详情 */
  async getRecordDetail(id: string) {
    // 非法 UUID 直接 404，避免 Prisma 抛错 500
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(id)) throw new BadRequestException('结算记录不存在');
    const record = await this.prisma.settlement_records.findUnique({
      where: { id },

    });
    if (!record) throw new BadRequestException('结算记录不存在');
    return toCamelDeep(record);
  }

  /** 生成本周期结算记录 */
    async generateRecord(data: {
    outletId: string;
    periodStart: string;
    periodEnd: string;
    userId?: string;
  }) {
    // V2.0 表重建后，旧结算生成逻辑（seal_orders/order_assignments）已废弃。
    // 生成结算请使用 V2.0 接口 POST /api/v2/admin/settlements（按供应商结算）。
    throw new BadRequestException('旧结算生成接口已废弃，请使用「结算管理(V2.0)」页面生成结算单');
  }

  /** 批量自动生成结算记录 */
    async autoGenerateRecords(data: {
    periodStart: string;
    periodEnd: string;
    userId?: string;
  }) {
    // V1 旧逻辑查 order_assignments/seal_orders 已废弃；V2.0 结算生成走 POST /api/v2/admin/settlements
    return [];
  }

  /** 根据周期类型与起算日计算结算周期起止日期（字符串 YYYY-MM-DD） */
  private calcPeriod(today: Date, cycle: string, startDay: number): { periodStart: string; periodEnd: string } {
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (cycle === 'daily') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1); // 昨天整天
      return { periodStart: fmt(y), periodEnd: fmt(y) };
    }
    if (cycle === 'weekly') {
      const offset = (today.getDay() - startDay + 7) % 7; // 距离上一个 startDay 的天数
      const lastStart = new Date(today);
      lastStart.setDate(lastStart.getDate() - offset - 7); // 上周的 startDay
      const lastEnd = new Date(lastStart);
      lastEnd.setDate(lastEnd.getDate() + 6); // 上周的 startDay+6（即上周日/上周六）
      return { periodStart: fmt(lastStart), periodEnd: fmt(lastEnd) };
    }
    if (cycle === 'monthly') {
      const y = today.getFullYear();
      const m = today.getMonth(); // 0-11
      const firstPrev = new Date(y, m - 1, 1); // 上月1号
      const lastPrev = new Date(y, m, 0); // 上月最后一天
      return { periodStart: fmt(firstPrev), periodEnd: fmt(lastPrev) };
    }
    return { periodStart: '', periodEnd: '' };
  }

  /** 判断今天是否应执行该周期的结算 */
  private shouldRunToday(today: Date, cycle: string, startDay: number): boolean {
    if (cycle === 'daily') return true;
    if (cycle === 'weekly') return today.getDay() === startDay;
    if (cycle === 'monthly') return today.getDate() === 1;
    return false;
  }

  /**
   * 定时任务入口：遍历所有启用且配置了自动结算周期的网点，
   * 按各自周期（天/周/月 + 周几起算）生成「待确认」结算单。
   * 不自动打款（status=1 待确认），打款需人工在后台确认。
   */
    async runScheduledSettlement() {
    // V1 定时结算（outlets.settlement_cycle）已废弃；V2.0 结算由管理员在「结算管理(V2.0)」手动生成
    return [];
  }

  /** 更新结算状态 */
  async updateStatus(id: string, status: number, userId?: string, remark?: string) {
    // V1 数字状态 → V2.0 字符串状态映射
    const STATUS_MAP: Record<number, string> = { 1: 'pending', 2: 'confirmed', 3: 'paid' };
    const newStatus = STATUS_MAP[status];
    if (newStatus === undefined) {
      throw new BadRequestException('无效的结算状态，合法值：1=待确认, 2=已确认, 3=已付款');
    }

    const updateData: any = {
      status: newStatus,
    };

    const oldRecord = await this.prisma.settlement_records.findUnique({ where: { id } });
    if (!oldRecord) {
      throw new BadRequestException('结算记录不存在');
    }

    if (newStatus === 'confirmed' && oldRecord.status === 'pending') {
      updateData.confirmed_by = userId;
      updateData.confirmed_at = new Date();
      updateData.confirm_remark = remark;
    }
    if (newStatus === 'paid') {
      updateData.paid_by = userId;
      updateData.paid_at = new Date();
      updateData.payment_method = 'bank_transfer';
      updateData.transaction_no = remark || updateData.transaction_no;
    }

    const record = await this.prisma.settlement_records.update({
      where: { id },
      data: updateData,
    });



    return toCamelDeep(record);
  }

  /** 删除结算记录 */
  async deleteRecord(id: string) {
    const record = await this.prisma.settlement_records.findUnique({ where: { id } });
    if (record && ['confirmed', 'paid'].includes(record.status)) {
      throw new BadRequestException('已结算或已付款的记录无法删除');
    }
    await this.prisma.settlement_records.delete({ where: { id } });
    return { success: true };
  }

  /** 导出结算对账单 */
  async exportRecords(params: {
    outletId?: string;
    status?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const records = await this.getRecords({ ...params, pageSize: 10000, page: 1 });
    return records.items;
  }

  /** 获取网点结算汇总 */
  async getOutletSummary() {
    const records: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT supplier_id AS outlet_id, supplier_name AS outlet_name,
             SUM(payable_amount)::numeric as total_outlet_amount,
             SUM(gross_amount)::numeric as total_order_amount,
             COUNT(*)::int as settlement_count
      FROM settlement_records
      GROUP BY supplier_id, supplier_name
      ORDER BY total_outlet_amount DESC
    `);
    return records.map((r) => ({
      outletId: r.outlet_id,
      outletName: r.outlet_name,
      totalOutletAmount: Number(r.total_outlet_amount) || 0,
      totalOrderAmount: Number(r.total_order_amount) || 0,
      settlementCount: Number(r.settlement_count) || 0,
    }));
  }

  /** 获取履约供应商待结算汇总（已完成未结算的订单） */
    async getOutletPendingSummary() {
    // V1 旧表 seal_orders/order_assignments 已废弃，V2.0 待结算数据在 /api/v2/admin/settlements 查询
    return [];
  }
}
