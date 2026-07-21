import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { REGION_MAP, provinceToRegion } from '../../common/region';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  // ==================== 网点通知相关 ====================

  /** 绑定网点负责人微信 openid（用于订阅消息通知） */
  async bindOpenid(outletId: string, openid: string) {
    if (!openid) throw new BadRequestException('openid 不能为空');
    await this.prisma.outlet.update({
      where: { id: outletId },
      data: { outletOpenid: openid },
    });
    return { success: true };
  }

  /** 开关订阅消息 */
  async toggleSubscribe(outletId: string, enabled: boolean) {
    await this.prisma.outlet.update({
      where: { id: outletId },
      data: { subscribeMsg: enabled ? 1 : 0 },
    });
    return { success: true };
  }

  // ==================== 网点 CRUD ====================

  /** 网点列表 */
  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: number; region?: string }) {
    const { page = 1, pageSize = 20, keyword, status } = params;
    const where: any = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { contact: { contains: keyword } },
        { phone: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = Number(status);
    if (params.region) {
      if (params.region === '未知') {
        where.province = { notIn: Object.keys(REGION_MAP) };
      } else {
        const provinces = Object.keys(REGION_MAP).filter(k => REGION_MAP[k] === params.region);
        where.province = { in: provinces };
      }
    }

    const [list, total] = await Promise.all([
      this.prisma.outlet.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.outlet.count({ where }),
    ]);

    return {
      list: list.map(s => ({
        ...s,
        region: provinceToRegion(s.province),
        password: undefined,
        totalOrders: s._count?.assignments ?? 0,
        statusText: s.status === 1 ? '营业中' : '已歇业',
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /** 网点详情 */
  async findOne(id: string) {
    const Outlet = await this.prisma.outlet.findUnique({ where: { id } });
    if (!Outlet) throw new NotFoundException('网点不存在');
    return { ...Outlet, password: undefined };
  }

  /** 新增网点 */
  async create(data: { name: string; contact: string; phone: string; province?: string; city?: string; address?: string; businessLicense?: string; specialPermits?: string[] }) {
    const existing = await this.prisma.outlet.findUnique({ where: { phone: data.phone } });
    if (existing) throw new BadRequestException('该手机号已被注册');

    const initPassword = Math.random().toString().slice(2, 10);
    const hashed = await bcrypt.hash(initPassword, 10);

    const Outlet = await this.prisma.outlet.create({
      data: {
        ...data,
        businessLicense: data.businessLicense || null,
        specialPermits: JSON.stringify(data.specialPermits || []),
        password: hashed,
        status: 1,
      },
    });

    return { ...Outlet, password: undefined, initPassword };
  }

  /** 编辑网点 */
  async update(id: string, data: { name?: string; contact?: string; phone?: string; province?: string; city?: string; address?: string; status?: number; businessLicense?: string; specialPermits?: string[] }) {
    if (data.phone) {
      const existing = await this.prisma.outlet.findFirst({ where: { phone: data.phone, NOT: { id } } });
      if (existing) throw new BadRequestException('该手机号已被其他网点使用');
    }
    const updateData: any = { ...data };
    updateData.businessLicense = data.businessLicense || null;
    updateData.specialPermits = JSON.stringify(data.specialPermits || []);
    const Outlet = await this.prisma.outlet.update({ where: { id }, data: updateData });
    return { ...Outlet, password: undefined };
  }

  /** 删除网点 */
  async remove(id: string) {
    const assignment = await this.prisma.orderAssignment.findFirst({
      where: { outletId: id, status: { in: [1, 2] } },
    });
    if (assignment) throw new BadRequestException('该网点存在未完成的订单，无法删除');

    await this.prisma.outlet.delete({ where: { id } });
    return { message: '删除成功' };
  }

  /** 重置网点密码 */
  async resetPassword(id: string) {
    const Outlet = await this.prisma.outlet.findUnique({ where: { id } });
    if (!Outlet) throw new NotFoundException('网点不存在');

    const newPassword = Math.random().toString().slice(2, 10);
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.outlet.update({ where: { id }, data: { password: hashed } });

    return { password: newPassword };
  }

  // ==================== 网点登录 ====================

  /** 网点登录 */
  async storeLogin(phone: string, password: string) {
    const Outlet = await this.prisma.outlet.findUnique({ where: { phone } });
    if (!Outlet) throw new NotFoundException('网点账号不存在');
    if (Outlet.status === 0) throw new BadRequestException('账号已被禁用，请联系管理员');

    const isMatch = await bcrypt.compare(password, Outlet.password);
    if (!isMatch) throw new BadRequestException('密码错误');

    await this.prisma.outlet.update({
      where: { id: Outlet.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      Outlet: { ...Outlet, password: undefined },
      requireChangePassword: false,
    };
  }

  /** 修改网点密码 */
  async changePassword(outletId: string, oldPassword: string, newPassword: string) {
    const Outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!Outlet) throw new NotFoundException('网点不存在');

    const isMatch = await bcrypt.compare(oldPassword, Outlet.password);
    if (!isMatch) throw new BadRequestException('原密码错误');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.outlet.update({ where: { id: outletId }, data: { password: hashed } });

    return { message: '密码修改成功' };
  }

  // ==================== 网点订单 ====================

  /** 网点单条订单详情 */
  async getStoreOrderDetail(outletId: string, orderId: string) {
    const assignment = await this.prisma.orderAssignment.findFirst({
      where: { orderId, outletId },
      include: {
        order: {
          include: {
            user: { select: { id: true, nickname: true, phone: true } },
            orderItems: true,
          },
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException('订单不存在或不属于当前网点');
    }

    // 回执列表
    const receipts = await this.prisma.deliveryReceipt.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderId: true, outletId: true, type: true, url: true, remark: true, createdAt: true },
    });

    return {
      id: assignment.id,
      orderId: assignment.orderId,
      orderNo: assignment.order.orderNo,
      companyName: assignment.order.companyName,
      type: assignment.order.type,
      status: assignment.order.status,
      statusText: assignment.order.statusText,
      expressNo: assignment.order.expressNo,
      createdAt: assignment.order.createdAt,
      acceptedAt: assignment.acceptedAt,
      completedAt: assignment.completedAt,
      assignmentStatus: assignment.status,
      assignmentStatusText: assignment.statusText,
      user: assignment.order.user,
      orderItems: assignment.order.orderItems,
      receipts,
    };
  }

  /** 网点订单列表（该网点分配的订单） */
  async getStoreOrders(outletId: string, params: { page?: number; pageSize?: number; status?: number }) {
    const { page = 1, pageSize = 20, status } = params;

    const where: any = { outletId };
    if (status !== undefined) where.status = Number(status);

    const [assignments, total] = await Promise.all([
      this.prisma.orderAssignment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { assignedAt: 'desc' },
        include: {
          order: {
            include: {
              user: { select: { id: true, nickname: true, phone: true } },
              orderItems: true,
            },
          },
        },
      }),
      this.prisma.orderAssignment.count({ where }),
    ]);

    return {
      list: assignments.map(a => ({
        id: a.id,
        orderId: a.orderId,
        orderNo: a.order.orderNo,
        companyName: a.order.companyName,
        type: a.order.type,
        status: a.status,
        statusText: a.statusText,
        assignedAt: a.assignedAt,
        acceptedAt: a.acceptedAt,
        completedAt: a.completedAt,
        user: a.order.user,
        orderItems: a.order.orderItems,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /** 网点统计 */
  async getStoreStats(outletId: string) {
    const [pending, processing, completed, todayTotal] = await Promise.all([
      this.prisma.orderAssignment.count({ where: { outletId, status: 1 } }),
      this.prisma.orderAssignment.count({ where: { outletId, status: 2 } }),
      this.prisma.orderAssignment.count({ where: { outletId, status: 3 } }),
      this.prisma.orderAssignment.count({
        where: {
          outletId,
          assignedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return { pending, processing, completed, todayTotal };
  }

  /** 全网点总览：按网点聚合订单状态 + 大区汇总 + Top10 */
  async getOverview() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const outlets = await this.prisma.outlet.findMany();
    const groups = await this.prisma.orderAssignment.groupBy({
      by: ['outletId', 'status'],
      _count: { _all: true },
    });
    const todayRows = await this.prisma.orderAssignment.findMany({
      where: { assignedAt: { gte: todayStart } },
      select: { outletId: true },
    });

    const stat: Record<string, { pending: number; processing: number; completed: number; today: number }> = {};
    for (const o of outlets) stat[o.id] = { pending: 0, processing: 0, completed: 0, today: 0 };
    for (const g of groups) {
      if (!stat[g.outletId]) stat[g.outletId] = { pending: 0, processing: 0, completed: 0, today: 0 };
      if (g.status === 1) stat[g.outletId].pending += g._count._all;
      else if (g.status === 2) stat[g.outletId].processing += g._count._all;
      else if (g.status === 3) stat[g.outletId].completed += g._count._all;
    }
    for (const t of todayRows) {
      if (stat[t.outletId]) stat[t.outletId].today += 1;
    }

    const outletStats = outlets.map(o => {
      const s = stat[o.id] || { pending: 0, processing: 0, completed: 0, today: 0 };
      return {
        id: o.id, name: o.name, province: o.province, city: o.city,
        region: provinceToRegion(o.province), status: o.status,
        totalOrders: s.pending + s.processing + s.completed,
        pending: s.pending, processing: s.processing, completed: s.completed, today: s.today,
      };
    });

    const regionMap: Record<string, any> = {};
    for (const o of outletStats) {
      const r = o.region;
      if (!regionMap[r]) regionMap[r] = { region: r, outletCount: 0, totalOrders: 0, pending: 0, processing: 0, completed: 0, provinces: [] as string[] };
      regionMap[r].outletCount += 1;
      regionMap[r].totalOrders += o.totalOrders;
      regionMap[r].pending += o.pending;
      regionMap[r].processing += o.processing;
      regionMap[r].completed += o.completed;
      if (o.province && !regionMap[r].provinces.includes(o.province)) regionMap[r].provinces.push(o.province);
    }

    const summary = {
      totalOutlets: outlets.length,
      activeOutlets: outlets.filter(o => o.status === 1).length,
      inactiveOutlets: outlets.filter(o => o.status !== 1).length,
      totalOrders: outletStats.reduce((s, o) => s + o.totalOrders, 0),
      totalPending: outletStats.reduce((s, o) => s + o.pending, 0),
      totalProcessing: outletStats.reduce((s, o) => s + o.processing, 0),
      totalCompleted: outletStats.reduce((s, o) => s + o.completed, 0),
      todayTotal: outletStats.reduce((s, o) => s + o.today, 0),
    };

    const topOutlets = [...outletStats].sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 10);

    return { summary, regions: Object.values(regionMap), outlets: outletStats, topOutlets };
  }

  // ==================== 网点订单操作 ====================

  /** 网点接单 */
  async acceptOrder(outletId: string, orderId: string) {
    // 验证订单归属
    const assignment = await this.prisma.orderAssignment.findFirst({
      where: { orderId, outletId },
    });
    if (!assignment) {
      throw new BadRequestException('订单不属于当前网点');
    }

    // 检查订单状态
    const order = await this.prisma.sealOrder.findUnique({
      where: { id: orderId },
      select: { status: true, module: true },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 2) {
      throw new BadRequestException('只能接已支付的订单');
    }

    // 更新订单状态为制作中
    await this.prisma.sealOrder.update({
      where: { id: orderId },
      data: { status: 3, statusText: '制作中' },
    });

    // 更新分配状态为进行中
    await this.prisma.orderAssignment.update({
      where: { orderId },
      data: { status: 2, statusText: '进行中', acceptedAt: new Date() },
    });

    return { success: true, message: '接单成功' };
  }

  /** 网点完成制作 */
  async completeOrder(outletId: string, orderId: string, remark?: string) {
    // 验证订单归属
    const assignment = await this.prisma.orderAssignment.findFirst({
      where: { orderId, outletId },
    });
    if (!assignment) {
      throw new BadRequestException('订单不属于当前网点');
    }

    // 检查订单状态
    const order = await this.prisma.sealOrder.findUnique({
      where: { id: orderId },
      select: { status: true, module: true },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 3) {
      throw new BadRequestException('只能完成制作中的订单');
    }

    // 状态保持 3，但标记为制作完成（等待发货或上传回执）
    await this.prisma.sealOrder.update({
      where: { id: orderId },
      data: { statusText: '制作完成待发货', remark },
    });

    return { success: true, message: '制作完成' };
  }

  /** 网点发货 */
  async shipOrder(outletId: string, orderId: string, trackingNo?: string, remark?: string) {
    // 验证订单归属
    const assignment = await this.prisma.orderAssignment.findFirst({
      where: { orderId, outletId },
    });
    if (!assignment) {
      throw new BadRequestException('订单不属于当前网点');
    }

    // 检查订单状态
    const order = await this.prisma.sealOrder.findUnique({
      where: { id: orderId },
      select: { status: true, module: true },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 3 && order.status !== 3.5) {
      throw new BadRequestException('只能发制作中或制作完成的订单');
    }

    // 更新订单状态为已发货
    await this.prisma.sealOrder.update({
      where: { id: orderId },
      data: {
        status: 4,
        statusText: '已发货',
        expressNo: trackingNo,
        remark,
      },
    });

    // 更新分配状态为已完成
    await this.prisma.orderAssignment.update({
      where: { orderId },
      data: { status: 3, statusText: '已完成', completedAt: new Date() },
    });

    return { success: true, message: '发货成功' };
  }
}

