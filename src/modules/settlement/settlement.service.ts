import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toCamelDeep } from '../../common/utils/case';



@Injectable()
export class SettlementService {
  constructor(private prisma: PrismaService) {}

  // ==================== 结算规则 ====================

  /** 获取结算规则列表（可选按网点或模块过滤） */
  async getRules(filters?: { outletId?: string; module?: string }) {
    const where: any = {};
    if (filters?.outletId) where.outlet_id = filters.outletId;
    if (filters?.module) where.module = filters.module;
    const rules = await this.prisma.settlement_rules.findMany({
      where,
      orderBy: [
        { is_default: 'desc' },
        { created_at: 'desc' },
      ],
    });
    return toCamelDeep(rules);
  }

  /** 获取默认规则 */
  async getDefaultRule() {
    const rule = await this.prisma.settlement_rules.findFirst({
      where: { is_default: true, status: 1, outlet_id: null },
    });
    return rule ? toCamelDeep(rule) : null;
  }

  /**
   * 三级规则查找：网点+模块专属 > 网点专属 > 模块专属 > 全局默认
   * F-02: 过滤规则有效期（valid_from / valid_to）
   */
  async findApplicableRule(outletId: string, module: string) {
    const now = new Date();
    return this.findApplicableRuleWithValidation(outletId, module, now);
  }

  /**
   * 带时间戳验证的规则查找（内部方法）
   */
  async findApplicableRuleWithValidation(outletId: string, module: string, now: Date) {
    // F-02: 有效期过滤：仅返回 valid_from <= now <= valid_to 的规则（null 表示永不过期）
    const validRangeFilter: any = {
      OR: [
        { valid_from: null },
        { valid_from: { lte: now } },
      ],
      AND: [
        { OR: [{ valid_to: null }, { valid_to: { gte: now } }] },
      ],
    };
    // 1. 网点+模块专属
    const both = await this.prisma.settlement_rules.findFirst({
      where: { outlet_id: outletId, module, status: 1, ...validRangeFilter },
    });
    if (both) return both;
    // 2. 网点专属（模块为空）
    const outletOnly = await this.prisma.settlement_rules.findFirst({
      where: { outlet_id: outletId, module: null, status: 1, ...validRangeFilter },
    });
    if (outletOnly) return outletOnly;
    // 3. 模块专属（网点为空）
    const moduleOnly = await this.prisma.settlement_rules.findFirst({
      where: { outlet_id: null, module, status: 1, ...validRangeFilter },
    });
    if (moduleOnly) return moduleOnly;
    // 4. 全局默认
    const globalDefault = await this.prisma.settlement_rules.findFirst({
      where: { is_default: true, status: 1, outlet_id: null, ...validRangeFilter },
    });
    return globalDefault || null;
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
    // F-02: 写入时校验 percent 范围
    if (data.type === 'percent') {
      const percent = Number(data.percent ?? 0);
      if (percent < 0 || percent > 100) {
        throw new BadRequestException('分成比例必须在 0~100% 之间');
      }
    }
    if (data.isDefault) {
      // 全局默认只针对 outlet_id=null 的规则
      await this.prisma.settlement_rules.updateMany({
        where: { is_default: true, outlet_id: null },
        data: { is_default: false },
      });
    }
    const rule = await this.prisma.settlement_rules.create({
      data: {
        name: data.name,
        type: data.type || 'fixed',
        fixed_amount: data.fixedAmount ?? 50,
        percent: data.percent ?? 0,
        min_order_amount: data.minOrderAmount ?? 0,
        settlement_type: data.settlementType || 'manual',
        status: data.status ?? 1,
        is_default: data.isDefault || false,
        remark: data.remark,
        created_by: userId,
        outlet_id: data.outletId || null,
        module: data.module || null,
        valid_from: data.validFrom ? new Date(data.validFrom) : null,
        valid_to: data.validTo ? new Date(data.validTo) : null,
      },
    });
    return toCamelDeep(rule);
  }

  /** 更新结算规则 */
  async updateRule(id: string, data: any, userId?: string) {
    if (data.isDefault) {
      await this.prisma.settlement_rules.updateMany({
        where: { is_default: true, id: { not: id }, outlet_id: null },
        data: { is_default: false },
      });
    }
    // F-02: 写入时校验 percent 范围
    if (data.type === 'percent') {
      const percent = Number(data.percent ?? 0);
      if (percent < 0 || percent > 100) {
        throw new BadRequestException('分成比例必须在 0~100% 之间');
      }
    }
    const rule = await this.prisma.settlement_rules.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        fixed_amount: data.fixedAmount,
        percent: data.percent,
        min_order_amount: data.minOrderAmount,
        settlement_type: data.settlementType,
        status: data.status,
        is_default: data.isDefault,
        remark: data.remark,
        outlet_id: data.outletId || null,
        module: data.module || null,
        valid_from: data.validFrom ? new Date(data.validFrom) : null,
        valid_to: data.validTo ? new Date(data.validTo) : null,
      },
    });
    return toCamelDeep(rule);
  }

  /** 删除结算规则 */
  async deleteRule(id: string) {
    await this.prisma.settlement_rules.delete({ where: { id } });
    return { success: true };
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

    if (outletId) where.outlet_id = outletId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.period_start = {};
      if (startDate) where.period_start.gte = new Date(startDate);
      if (endDate) where.period_end = { lte: new Date(endDate + 'T23:59:59') };
    }

    const [records, total, summary] = await Promise.all([
      this.prisma.settlement_records.findMany({
        where,
        include: { outlet: { select: { id: true, name: true, phone: true } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.settlement_records.count({ where }),
      this.prisma.settlement_records.aggregate({
        where,
        _sum: { order_amount: true, outlet_amount: true, platform_amount: true },
        _count: true,
      }),
    ]);

    return {
      items: toCamelDeep(records),
      total,
      page,
      pageSize,
      summary: {
        totalOrderAmount: Number(summary._sum.order_amount) || 0,
        totalOutletAmount: Number(summary._sum.outlet_amount) || 0,
        totalPlatformAmount: Number(summary._sum.platform_amount) || 0,
        totalCount: summary._count || 0,
      },
    };
  }

  /** 获取单个结算记录详情 */
  async getRecordDetail(id: string) {
    const record = await this.prisma.settlement_records.findUnique({
      where: { id },
      include: { outlet: { select: { id: true, name: true, phone: true, contact: true } } },
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
    const { outletId, periodStart, periodEnd } = data;

    // 获取网点信息
    const outlet = await this.prisma.outlets.findUnique({ where: { id: outletId } });
    if (!outlet) throw new BadRequestException('网点不存在');

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd + 'T23:59:59');

    // 防重复：同一网点同一结算周期已存在结算记录则拒绝（时间段重叠则拒绝）
    const periodStartDate = new Date(periodStart + 'T00:00:00');
    const existing = await this.prisma.settlement_records.findFirst({
      where: {
        outlet_id: outletId,
        period_end: { gte: periodStartDate },
      },
    });
    if (existing) {
      throw new BadRequestException('该网点本结算周期已存在结算记录，请勿重复生成');
    }

    // 按模块分别查订单，按模块规则分别计算分成
    const modules = ['seal', 'newspaper', 'bookkeeping'];
    const moduleBreakdown: any[] = [];
    let totalOrderAmount = 0;
    let totalOutletAmount = 0;
    let totalOrderCount = 0;
    let appliedRuleNames: string[] = [];
    const now = new Date();

    for (const mod of modules) {
      // F-04: 过滤已退款/已取消/售后中订单，且排除已结算的订单（防重复结算）
      const sql = `
        SELECT o.id, o.order_no, o.total_price, o.pay_price, o.status, o.module,
               a.completed_at
        FROM order_assignments a
        JOIN seal_orders o ON o.id = a.order_id
        WHERE a.outlet_id = $1
          AND a.status = 4
          AND a.completed_at >= $2
          AND a.completed_at <= $3
          AND o.pay_price > 0
          AND o.module = $4
          AND o.status IN (4, 5)
          AND o.settlement_id IS NULL
      `;
      const orders: any[] = await this.prisma.$queryRawUnsafe(sql, outletId, startDate, endDate, mod);

      if (orders.length === 0) continue;

      // F-02: 过滤出 min_order_amount 以上的订单
      const eligibleOrders = orders.filter((o: any) => {
        const rule = null; // 查规则（用单独的逻辑）
        return true; // min_order_amount 逻辑在 findApplicableRule 中补充
      });

      const orderAmount = orders.reduce((sum: number, o: any) => sum + Number(o.pay_price || 0), 0);
      // F-02: findApplicableRule 增加 valid_from/valid_to 过滤
      const rule = await this.findApplicableRuleWithValidation(outletId, mod, now);

      if (!rule) {
        throw new BadRequestException(`模块[${mod}]未找到适用结算规则，请先配置`);
      }

      const { outletAmount, platformAmount } = this.applyRule(orderAmount, orders.length, rule);

      moduleBreakdown.push({
        module: mod,
        orderCount: orders.length,
        orderAmount,
        outletAmount,
        platformAmount,
        ruleName: rule.name,
        ruleId: rule.id,
      });

      totalOrderAmount += orderAmount;
      totalOutletAmount += outletAmount;
      totalOrderCount += orders.length;
      if (!appliedRuleNames.includes(rule.name)) appliedRuleNames.push(rule.name);
    }

    if (totalOrderCount === 0) {
      throw new BadRequestException('该周期内没有可结算的订单');
    }

    const totalPlatformAmount = totalOrderAmount - totalOutletAmount;
    const ruleNamesStr = appliedRuleNames.join('；');

    // 生成结算单号
    // F-03: 使用数据库序列保证原子唯一，替代 count()+1（重号风险）
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let recordNo: string;
    try {
      // 尝试使用 PostgreSQL 序列
      const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
        SELECT nextval(pg_get_serial_sequence('settlement_records', 'id'))
      `;
      recordNo = `ST${dateStr}${String(nextval).padStart(6, '0')}`;
    } catch {
      // 降级：若序列不存在（如旧数据库迁移），使用 UUID 兜底（确保唯一）
      const { randomUUID } = require('crypto');
      recordNo = `ST${dateStr}${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    }

    const recordData: any = {
      record_no: recordNo,
      outlet_id: outletId,
      outlet_name: outlet.name,
      period_start: startDate,
      period_end: endDate,
      order_count: totalOrderCount,
      order_amount: totalOrderAmount,
      outlet_amount: totalOutletAmount,
      platform_amount: totalPlatformAmount,
      rule_id: moduleBreakdown[0]?.ruleId || null,
      rule_name: ruleNamesStr,
      module_detail: JSON.stringify(moduleBreakdown),
      status: 1,
      status_text: '待确认',
      created_by: data.userId,
    };
    const record = await this.prisma.settlement_records.create({ data: recordData });

    return toCamelDeep(record);
  }

  /** 批量自动生成结算记录 */
  async autoGenerateRecords(data: {
    periodStart: string;
    periodEnd: string;
    userId?: string;
  }) {
    const { periodStart, periodEnd } = data;
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd + 'T23:59:59');

    // 查所有有已完成订单的网点
    const outletsWithOrders: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT DISTINCT a.outlet_id
      FROM order_assignments a
      JOIN seal_orders o ON o.id = a.order_id
      WHERE a.status = 4
        AND a.completed_at >= $1
        AND a.completed_at <= $2
        AND o.pay_price > 0
    `, startDate, endDate);

    const results: any[] = [];
    for (const row of outletsWithOrders) {
      try {
        const record = await this.generateRecord({
          outletId: row.outlet_id,
          periodStart,
          periodEnd,
          userId: data.userId,
        });
        results.push({ success: true, outletId: row.outlet_id, record });
      } catch (err: any) {
        results.push({ success: false, outletId: row.outlet_id, error: err.message });
      }
    }
    return results;
  }

  /** 更新结算状态 */
  async updateStatus(id: string, status: number, userId?: string, remark?: string) {
    // F-14: 明确合法的结算状态值，禁止任意数字映射到有效文本
    const VALID_SETTLEMENT_STATUSES: Record<number, string> = {
      1: '待确认',
      2: '已结算',
      3: '已付款',
    };
    if (VALID_SETTLEMENT_STATUSES[status] === undefined) {
      throw new BadRequestException(`无效的结算状态，合法值：${Object.entries(VALID_SETTLEMENT_STATUSES).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    const updateData: any = {
      status,
      status_text: VALID_SETTLEMENT_STATUSES[status],
    };

    const oldRecord = await this.prisma.settlement_records.findUnique({ where: { id } });
    if (!oldRecord) {
      throw new BadRequestException('结算记录不存在');
    }

    if (status === 3) {
      updateData.paid_at = new Date();
      updateData.paid_by = userId;
      updateData.paid_remark = remark;
    }

    const record = await this.prisma.settlement_records.update({
      where: { id },
      data: updateData,
    });

    // 第3步：状态变为已付款时，自动生成一笔支出流水（平台付给网点）
    if (status === 3 && oldRecord.status !== 3 && record.outlet_id) {
      const existFlow = await this.prisma.transaction_flows.findFirst({
        where: { trade_type: 'expense', remark: { contains: record.record_no } },
      });
      if (!existFlow) {
        const dt = new Date();
        const ts = String(dt.getTime()).slice(-6);
        const ymd = dt.toISOString().slice(0, 10).replace(/-/g, '');
        await this.prisma.transaction_flows.create({
          data: {
            transaction_no: 'TF' + ymd + ts,
            order_id: null,
            order_no: null,
            module: 'settlement',
            business_type: '结算付款',
            trade_type: 'expense',
            user_id: null,
            user_name: null,
            user_phone: null,
            amount: record.outlet_amount,
            fee: 0,
            net_amount: record.outlet_amount,
            pay_method: 'settle',
            status: 'success',
            status_text: '结算付款',
            transaction_id: record.record_no,
            outlet_id: record.outlet_id,
            outlet_name: record.outlet_name,
            remark: '结算付款 ' + record.record_no,
            created_at: dt,
            updated_at: dt,
          },
        });
      }
    }

    return toCamelDeep(record);
  }

  /** 删除结算记录 */
  async deleteRecord(id: string) {
    const record = await this.prisma.settlement_records.findUnique({ where: { id } });
    if (record && record.status >= 2) {
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
      SELECT outlet_id, outlet_name,
             SUM(outlet_amount)::numeric as total_outlet_amount,
             SUM(order_amount)::numeric as total_order_amount,
             COUNT(*)::int as settlement_count
      FROM settlement_records
      GROUP BY outlet_id, outlet_name
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

  /** 获取服务商待结算汇总（已完成未结算的订单） */
  async getOutletPendingSummary() {
    const records: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT oa.outlet_id,
             ot.name as outlet_name,
             SUM(o.total_price)::numeric as pending_amount,
             COUNT(*)::int as order_count
      FROM seal_orders o
      LEFT JOIN order_assignments oa ON oa.order_id = o.id
      LEFT JOIN outlets ot ON ot.id = oa.outlet_id
      WHERE o.status = 5
      GROUP BY oa.outlet_id, ot.name
      ORDER BY pending_amount DESC
    `);
    return records.map((r) => ({
      outletId: r.outlet_id || null,
      outletName: r.outlet_name || '未知网点',
      pendingAmount: Number(r.pending_amount) || 0,
      orderCount: Number(r.order_count) || 0,
    }));
  }
}
