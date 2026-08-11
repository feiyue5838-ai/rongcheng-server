import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { REGION_MAP, provinceToRegion } from '../../common/region';
import { randomBytes } from 'crypto';
import { toCamelDeep } from '../../common/utils/case';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  // ==================== 网点通知相关 ====================

  /** 绑定网点负责人微信 openid（用于订阅消息通知） */
  async bindOpenid(outlet_id: string, openid: string) {
    if (!openid) throw new BadRequestException('openid 不能为空');
    // S-05: 唯一性校验 — 同一 openid 不能绑定到其他网点
    const existing = await this.prisma.outlets.findFirst({
      where: { outlet_openid: openid, NOT: { id: outlet_id } },
    });
    if (existing) throw new BadRequestException('该微信号已绑定其他网点，请先解绑后再试');
    await this.prisma.outlets.update({
      where: { id: outlet_id },
      data: { outlet_openid: openid },
    });
    return { success: true };
  }

  /** 开关订阅消息 */
  async toggleSubscribe(outlet_id: string, enabled: boolean) {
    await this.prisma.outlets.update({
      where: { id: outlet_id },
      data: { subscribe_msg: enabled ? 1 : 0 },
    });
    return { success: true };
  }

  // ==================== 网点 CRUD ====================

  /** 网点列表 */
  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: number; region?: string; province?: string; city?: string; district?: string; businessType?: string }) {
    const { page = 1, pageSize = 20, keyword, status } = params;
    const where: any = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { contact: { contains: keyword } },
        { phone: { contains: keyword } },
      ];
    }
    // 默认查询营业中和歇业网点（避免 Prisma 空 where 报错）
    const statusVal = status !== undefined && status !== null ? Number(status) : NaN;
    if (!Number.isNaN(statusVal)) {
      where.status = statusVal;
    } else {
      where.status = { in: [0, 1] };
    }
    if (params.province) {
      where.province = params.province;
    }
    if (params.city) {
      where.city = params.city;
    }
    if (params.district) {
      where.district = params.district;
    }
    if (params.region) {
      if (params.region === '未知') {
        where.province = { ...where.province, notIn: Object.keys(REGION_MAP) };
      } else {
        const provinces = Object.keys(REGION_MAP).filter(k => REGION_MAP[k] === params.region);
        where.province = { in: provinces };
      }
    }
    if (params.businessType) {
      where.outlet_business_types = {
        some: {
          business_type: { code: params.businessType },
        },
      };
    }

    const [list, total] = await Promise.all([
      this.prisma.outlets.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { assignments: true } },
          outlet_business_types: { include: { business_type: true } },
        },
      }),
      this.prisma.$queryRawUnsafe<[{ count: bigint }]>('SELECT COUNT(*) FROM "outlets"').then(r => Number(r[0].count)),
    ]);

    return {
      list: list.map(s => toCamelDeep({
        ...s,
        region: provinceToRegion(s.province),
        password: undefined,
        totalOrders: s._count?.assignments ?? 0,
        statusText: s.status === 1 ? '营业中' : '已歇业',
        businessTypes: s.outlet_business_types?.map(t => ({ id: t.business_type.id, name: t.business_type.name, code: t.business_type.code })) ?? [],
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /** 网点详情 */
  async findOne(id: string) {
    const Outlet = await this.prisma.outlets.findUnique({ 
      where: { id },
      include: { outlet_business_types: { include: { business_type: true } } },
    });
    if (!Outlet) throw new NotFoundException('网点不存在');
    const totalOrders = await this.prisma.order_assignments.count({ where: { outlet_id: id } });
    return {
      ...toCamelDeep(Outlet),
      password: undefined,
      totalOrders,
      businessTypes: Outlet.outlet_business_types?.map(t => ({ id: t.business_type.id, name: t.business_type.name, code: t.business_type.code })) ?? [],
    };
  }

  /** 新增网点 */
  async create(data: { name: string; contact: string; phone: string; province?: string; city?: string; district?: string; address?: string; business_license?: string; special_permits?: string[]; businessTypeIds?: string[]; settlementCycle?: string; settlementWeeklyStartDay?: number }) {
    const existing = await this.prisma.outlets.findUnique({ where: { phone: data.phone } });
    if (existing) throw new BadRequestException('该手机号已被注册');

    const initPassword = randomBytes(6).toString('base64url').slice(0, 12);
    const hashed = await bcrypt.hash(initPassword, 10);

    const { businessTypeIds, ..._unused } = data;
    const Outlet = await this.prisma.outlets.create({
      data: {
        name: data.name,
        contact: data.contact,
        phone: data.phone,
        province: data.province,
        city: data.city,
        district: data.district,
        address: data.address,
        business_license: data.business_license || null,
        special_permits: JSON.stringify(data.special_permits || []),
        password: hashed,
        status: 1,
        settlement_cycle: data.settlementCycle ?? null,
        settlement_weekly_start_day: data.settlementWeeklyStartDay ?? 1,
      },
    });

    // 批量创建业务类型关联
    if (data.businessTypeIds?.length) {
      // data.businessTypeIds 是 code 列表（如 'seal'），需要查 uuid
      for (const code of data.businessTypeIds) {
        const bt = await this.prisma.business_types.findUnique({ where: { code } });
        if (bt) {
          await this.prisma.outlet_business_types.create({
            data: { outlet_id: Outlet.id, business_type_id: bt.id },
          });
        }
      }
    }

    return { ...Outlet, password: undefined, initPassword };
  }

  /** 独立接口：设置网点业务授权 */
  async setBusinessTypes(id: string, businessTypeIds: string[]) {
    const outlet = await this.prisma.outlets.findUnique({ where: { id } });
    if (!outlet) throw new NotFoundException('网点不存在');

    // 先清空
    await this.prisma.outlet_business_types.deleteMany({ where: { outlet_id: id } });
    // 再重建
    for (const btId of businessTypeIds) {
      const bt = await this.prisma.business_types.findUnique({ where: { id: btId } });
      if (bt) {
        await this.prisma.outlet_business_types.create({
          data: { outlet_id: id, business_type_id: bt.id },
        });
      }
    }
    // 返回更新后的完整信息
    const updated = await this.prisma.outlets.findUnique({
      where: { id },
      include: {
        outlet_business_types: { include: { business_type: true } },
      },
    });
    return {
      id: updated!.id,
      name: updated!.name,
      businessTypes: updated!.outlet_business_types.map(t => ({
        id: t.business_type.id,
        name: t.business_type.name,
        code: t.business_type.code,
      })),
    };
  }

  /** 编辑网点 */
  async update(id: string, data: { name?: string; contact?: string; phone?: string; province?: string; city?: string; district?: string; address?: string; status?: number; business_license?: string; special_permits?: string[]; businessTypeIds?: string[]; settlementCycle?: string; settlementWeeklyStartDay?: number }) {
    if (data.phone) {
      const existing = await this.prisma.outlets.findFirst({ where: { phone: data.phone, NOT: { id } } });
      if (existing) throw new BadRequestException('该手机号已被其他网点使用');
    }
    const { businessTypeIds, ..._unused } = data;
    // S-09: 修复静默清空字段 — 只在字段显式传入时才更新，避免未提交字段被覆盖
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.contact !== undefined) updateData.contact = data.contact;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.province !== undefined) updateData.province = data.province;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.district !== undefined) updateData.district = data.district;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.business_license !== undefined) updateData.business_license = data.business_license || null;
    if (data.special_permits !== undefined) updateData.special_permits = JSON.stringify(data.special_permits || []);
    if (data.settlementCycle !== undefined) updateData.settlement_cycle = data.settlementCycle; // 允许设为 null 关闭自动结算
    if (data.settlementWeeklyStartDay !== undefined) updateData.settlement_weekly_start_day = data.settlementWeeklyStartDay;
    if (Object.keys(updateData).length === 0) {
      // 无任何字段变更，直接返回现有数据
      return this.findOne(id);
    }
    const Outlet = await this.prisma.outlets.update({ where: { id }, data: updateData });

    // 更新业务类型关联
    if (businessTypeIds !== undefined) {
      await this.prisma.outlet_business_types.deleteMany({ where: { outlet_id: id } });
      if (businessTypeIds.length > 0) {
        for (const code of businessTypeIds) {
          const bt = await this.prisma.business_types.findUnique({ where: { code } });
          if (bt) {
            await this.prisma.outlet_business_types.create({
              data: { outlet_id: id, business_type_id: bt.id },
            });
          }
        }
      }
    }
    return { ...Outlet, password: undefined };
  }

  /** 删除网点（S-10: 改为软删除，防止历史数据外键断裂） */
  async remove(id: string) {
    const assignment = await this.prisma.order_assignments.findFirst({
      where: { outlet_id: id, status: { in: [1, 2] } },
    });
    if (assignment) throw new BadRequestException('该网点存在未完成的订单，无法删除');

    // S-10: 软删除（status=-1），保留历史数据外键完整性
    await this.prisma.outlets.update({
      where: { id },
      data: { status: -1 },
    });
    return { message: '删除成功（已软删除）' };
  }

  /** 重置网点密码 */
  async resetPassword(id: string) {
    const Outlet = await this.prisma.outlets.findUnique({ where: { id } });
    if (!Outlet) throw new NotFoundException('网点不存在');

    // S-07: 使用 crypto.randomBytes 替代 Math.random()，12位强随机
    const newPassword = randomBytes(6).toString('base64url').slice(0, 12);
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.outlets.update({ where: { id }, data: { password: hashed } });

    // S-08: 明文密码通过返回值返回给管理员后，由管理员转告网点；
    // 拦截器会对此返回值做敏感字段脱敏（见 operation-log.interceptor.ts）
    return { password: newPassword };
  }

  // ==================== 网点登录 ====================

  /** 网点登录 */
  async storeLogin(phone: string, password: string) {
    const Outlet = await this.prisma.outlets.findUnique({ where: { phone } });
    if (!Outlet) throw new NotFoundException('网点账号不存在');
    if (Outlet.status === 0) throw new BadRequestException('账号已被禁用，请联系管理员');

    const isMatch = await bcrypt.compare(password, Outlet.password);
    if (!isMatch) throw new BadRequestException('密码错误');

    await this.prisma.outlets.update({
      where: { id: Outlet.id },
      data: { last_login_at: new Date() },
    });

    return {
      Outlet: { ...Outlet, password: undefined },
      requireChangePassword: false,
    };
  }

  /** 修改网点密码 */
  async changePassword(outlet_id: string, oldPassword: string, newPassword: string) {
    const Outlet = await this.prisma.outlets.findUnique({ where: { id: outlet_id } });
    if (!Outlet) throw new NotFoundException('网点不存在');

    const isMatch = await bcrypt.compare(oldPassword, Outlet.password);
    if (!isMatch) throw new BadRequestException('原密码错误');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.outlets.update({ where: { id: outlet_id }, data: { password: hashed } });

    return { message: '密码修改成功' };
  }

  // ==================== 网点订单 ====================

  /** 网点单条订单详情 */
  async getStoreOrderDetail(outlet_id: string, order_id: string) {
    const assignment = await this.prisma.order_assignments.findFirst({
      where: { order_id, outlet_id },
      include: {
        outlet: { select: { id: true, name: true } },
        seal_orders: {
          include: {
            user: { select: { id: true, nickname: true, phone: true } },
            order_items: true,
          },
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException('订单不存在或不属于当前网点');
    }

    // 回执列表
    const receipts = await this.prisma.delivery_receipts.findMany({
      where: { order_id },
      orderBy: { created_at: 'desc' },
      select: { id: true, order_id: true, outlet_id: true, type: true, url: true, remark: true, created_at: true },
    });

    return {
      id: assignment.id,
      order_id: assignment.order_id,
      order_no: assignment.seal_orders.order_no,
      company_name: assignment.seal_orders.company_name,
      type: assignment.seal_orders.type,
      status: assignment.seal_orders.status,
      status_text: assignment.seal_orders.status_text,
      address_json: assignment.seal_orders.address_json,
      contact_phone: assignment.seal_orders.contact_phone,
      seal_reason: assignment.seal_orders.seal_reason,
      legal_phone: assignment.seal_orders.legal_phone,
      express_company: assignment.seal_orders.express_company,
      express_no: assignment.seal_orders.express_no,
      created_at: assignment.seal_orders.created_at,
      accepted_at: assignment.accepted_at,
      completed_at: assignment.completed_at,
      assignment_status: assignment.status,
      assignmentStatusText: assignment.status_text,
      user: assignment.seal_orders.user,
      order_items: assignment.seal_orders.order_items,
      outlet: assignment.outlet,
      receipts,
    };
  }

  /** 网点订单列表（该网点分配的订单） */
  async getStoreOrders(outlet_id: string, params: { page?: number; pageSize?: number; status?: number }) {
    const { page = 1, pageSize = 20, status } = params;

    const where: any = { outlet_id };
    const statusVal = status !== undefined && status !== null ? Number(status) : NaN;
    if (!Number.isNaN(statusVal)) {
      where.status = statusVal;
    } else {
      where.status = { in: [1, 2, 3] };
    }

    const [assignments, total] = await Promise.all([
      this.prisma.order_assignments.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { assigned_at: 'desc' },
        include: {
          seal_orders: {
            include: {
              user: { select: { id: true, nickname: true, phone: true } },
              order_items: true,
            },
          },
        },
      }),
      this.prisma.order_assignments.count({ where }),
    ]);

    return toCamelDeep({
      list: assignments.map(a => ({
        id: a.id,
        order_id: a.order_id,
        order_no: a.seal_orders.order_no,
        company_name: a.seal_orders.company_name,
        type: a.seal_orders.type,
        status: a.status,
        status_text: a.status_text,
        assigned_at: a.assigned_at,
        accepted_at: a.accepted_at,
        completed_at: a.completed_at,
        user: a.seal_orders.user,
        order_items: a.seal_orders.order_items,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }

  /** 网点统计 */
  async getStoreStats(outlet_id: string) {
    // S-11: 统计口径统一：completed = status=4（网点完成交付，即 assignment.status=4）
    const [pending, processing, completed, todayTotal] = await Promise.all([
      this.prisma.order_assignments.count({ where: { outlet_id, status: 1 } }),
      this.prisma.order_assignments.count({ where: { outlet_id, status: 2 } }),
      this.prisma.order_assignments.count({ where: { outlet_id, status: 4 } }),
      this.prisma.order_assignments.count({
        where: {
          outlet_id,
          assigned_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return { pending, processing, completed, todayTotal };
  }

  /** 全网点总览：按网点聚合订单状态 + 大区汇总 + Top10 */
  async getOverview() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const outlets = await this.prisma.outlets.findMany({
      where: { status: { in: [0, 1] } },
    });
    const groups = await this.prisma.order_assignments.groupBy({
      by: ['outlet_id', 'status'],
      _count: { _all: true },
    });
    const todayRows = await this.prisma.order_assignments.findMany({
      where: { assigned_at: { gte: todayStart } },
      select: { outlet_id: true },
    });

    const stat: Record<string, { pending: number; processing: number; completed: number; today: number }> = {};
    for (const o of outlets) stat[o.id] = { pending: 0, processing: 0, completed: 0, today: 0 };
    for (const g of groups) {
      if (!stat[g.outlet_id]) stat[g.outlet_id] = { pending: 0, processing: 0, completed: 0, today: 0 };
      if (g.status === 1) stat[g.outlet_id].pending += g._count._all;
      else if (g.status === 2) stat[g.outlet_id].processing += g._count._all;
      // S-11: completed 统计 assignment.status=4（网点完成交付），而非 status=3
      else if (g.status === 4) stat[g.outlet_id].completed += g._count._all;
    }
    for (const t of todayRows) {
      if (stat[t.outlet_id]) stat[t.outlet_id].today += 1;
    }

    const outletStats = outlets.map(o => {
      const s = stat[o.id] || { pending: 0, processing: 0, completed: 0, today: 0 };
      return {
        id: o.id, name: o.name, province: o.province, city: o.city,
        region: provinceToRegion(o.province), status: o.status,
        total_orders: s.pending + s.processing + s.completed,
        pending: s.pending, processing: s.processing, completed: s.completed, today: s.today,
      };
    });

    const regionMap: Record<string, any> = {};
    for (const o of outletStats) {
      const r = o.region;
      if (!regionMap[r]) regionMap[r] = { region: r, outletCount: 0, total_orders: 0, pending: 0, processing: 0, completed: 0, provinces: [] as string[] };
      regionMap[r].outletCount += 1;
      regionMap[r].total_orders += o.total_orders;
      regionMap[r].pending += o.pending;
      regionMap[r].processing += o.processing;
      regionMap[r].completed += o.completed;
      if (o.province && !regionMap[r].provinces.includes(o.province)) regionMap[r].provinces.push(o.province);
    }

    const summary = {
      totalOutlets: outlets.length,
      activeOutlets: outlets.filter(o => o.status === 1).length,
      inactiveOutlets: outlets.filter(o => o.status !== 1).length,
      total_orders: outletStats.reduce((s, o) => s + o.total_orders, 0),
      totalPending: outletStats.reduce((s, o) => s + o.pending, 0),
      totalProcessing: outletStats.reduce((s, o) => s + o.processing, 0),
      totalCompleted: outletStats.reduce((s, o) => s + o.completed, 0),
      todayTotal: outletStats.reduce((s, o) => s + o.today, 0),
    };

    const topOutlets = [...outletStats].sort((a, b) => b.total_orders - a.total_orders).slice(0, 10);

    return toCamelDeep({ summary, regions: Object.values(regionMap), outlets: outletStats, topOutlets });
  }

  // ==================== 网点订单操作 ====================

  /** 网点接单 */
  async acceptOrder(outlet_id: string, order_id: string) {
    // 验证订单归属
    const assignment = await this.prisma.order_assignments.findFirst({
      where: { order_id, outlet_id },
    });
    if (!assignment) {
      throw new BadRequestException('订单不属于当前网点');
    }

    // 检查订单状态
    const order = await this.prisma.seal_orders.findUnique({
      where: { id: order_id },
      select: { status: true, module: true },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 2) {
      throw new BadRequestException('只能接已支付的订单');
    }

    // 更新订单状态为制作中
    await this.prisma.seal_orders.update({
      where: { id: order_id },
      data: { status: 3, status_text: '制作中' },
    });

    // 更新分配状态为进行中
    await this.prisma.order_assignments.update({
      where: { order_id },
      data: { status: 2, status_text: '进行中', accepted_at: new Date() },
    });

    return { success: true, message: '接单成功' };
  }

  /** 网点完成制作 */
  async completeOrder(outlet_id: string, order_id: string, remark?: string) {
    // 验证订单归属
    const assignment = await this.prisma.order_assignments.findFirst({
      where: { order_id, outlet_id },
    });
    if (!assignment) {
      throw new BadRequestException('订单不属于当前网点');
    }

    // 检查订单状态
    const order = await this.prisma.seal_orders.findUnique({
      where: { id: order_id },
      select: { status: true, module: true, remark: true },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 3) {
      throw new BadRequestException('只能完成制作中的订单');
    }

    // S-03: remark 字段被系统用作 JSON 元数据容器（退款/售后/记账等），
    // 网点备注不能直接覆盖，只能合并到 outlet_remark 字段
    // 为避免 DB 变更，此处将网点提交的 remark 追加到现有 remark 中
    let finalRemark = order.remark || '';
    if (remark) {
      try {
        const obj = JSON.parse(order.remark || '{}');
        obj.outletRemark = remark;
        finalRemark = JSON.stringify(obj);
      } catch {
        // remark 不是 JSON：追加文本（保留原内容）
        finalRemark = (order.remark || '') + ' [网点:' + remark + ']';
      }
    }
    // 状态保持 3，但标记为制作完成（等待发货或上传回执）
    await this.prisma.seal_orders.update({
      where: { id: order_id },
      data: { status_text: '制作完成待发货', remark: finalRemark },
    });

    // 同步更新分配记录状态（管理后台按 assignment 统计，避免状态不一致）
    await this.prisma.order_assignments.update({
      where: { order_id },
      data: { status_text: '制作完成待发货' },
    });

    return { success: true, message: '制作完成' };
  }

  /** 网点发货 */
  async shipOrder(outlet_id: string, order_id: string, expressCompany: string | undefined, trackingNo: string | undefined, remark?: string) {
    // 验证订单归属
    const assignment = await this.prisma.order_assignments.findFirst({
      where: { order_id, outlet_id },
    });
    if (!assignment) {
      throw new BadRequestException('订单不属于当前网点');
    }

    // 检查订单状态
    const order = await this.prisma.seal_orders.findUnique({
      where: { id: order_id },
      select: { status: true, module: true, remark: true },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    // S-06: 移除 status !== 3.5 的死条件（3.5 状态从未存在）
    if (order.status !== 3) {
      throw new BadRequestException('只能发制作中的订单');
    }

    // S-02: 强制要求物流单号
    if (!trackingNo?.trim()) {
      throw new BadRequestException('请填写物流单号');
    }
    if (!expressCompany?.trim()) {
      throw new BadRequestException('请选择快递公司');
    }

    // S-03: remark 合并（同 completeOrder 逻辑）
    let finalRemark = order.remark || '';
    if (remark) {
      try {
        const obj = JSON.parse(order.remark || '{}');
        obj.outletRemark = remark;
        finalRemark = JSON.stringify(obj);
      } catch {
        finalRemark = (order.remark || '') + ' [网点:' + remark + ']';
      }
    }

    // S-02: 写入 express_company + express_no + delivery_status
    await this.prisma.seal_orders.update({
      where: { id: order_id },
      data: {
        status: 4,
        status_text: '已发货',
        express_company: expressCompany?.trim(),
        express_no: trackingNo?.trim(),
        delivery_status: 1,
        remark: finalRemark,
      },
    });

    // 更新分配状态为已完成
    await this.prisma.order_assignments.update({
      where: { order_id },
      data: { status: 3, status_text: '已完成', completed_at: new Date() },
    });

    return { success: true, message: '发货成功' };
  }
}

