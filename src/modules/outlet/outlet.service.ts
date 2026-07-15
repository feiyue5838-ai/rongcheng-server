import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  // ==================== 网点 CRUD ====================

  /** 网点列表 */
  async findAll(params: { page?: number; pageSize?: number; keyword?: string; status?: number }) {
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
  async create(data: { name: string; contact: string; phone: string; province?: string; city?: string; address?: string }) {
    const existing = await this.prisma.outlet.findUnique({ where: { phone: data.phone } });
    if (existing) throw new BadRequestException('该手机号已被注册');

    const initPassword = Math.random().toString().slice(2, 8);
    const hashed = await bcrypt.hash(initPassword, 10);

    const Outlet = await this.prisma.outlet.create({
      data: { ...data, password: hashed, status: 1 },
    });

    return { ...Outlet, password: undefined, initPassword };
  }

  /** 编辑网点 */
  async update(id: string, data: { name?: string; contact?: string; phone?: string; province?: string; city?: string; address?: string; status?: number }) {
    if (data.phone) {
      const existing = await this.prisma.outlet.findFirst({ where: { phone: data.phone, NOT: { id } } });
      if (existing) throw new BadRequestException('该手机号已被其他网点使用');
    }
    const Outlet = await this.prisma.outlet.update({ where: { id }, data });
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

    const newPassword = Math.random().toString().slice(2, 8);
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

  /** 网点接单 */
  async acceptOrder(assignmentId: string, outletId: string) {
    const assignment = await this.prisma.orderAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('分配记录不存在');
    if (assignment.outletId !== outletId) throw new BadRequestException('无权操作此订单');
    if (assignment.status !== 1) throw new BadRequestException('当前状态无法接单');

    await this.prisma.$transaction([
      this.prisma.orderAssignment.update({
        where: { id: assignmentId },
        data: { status: 2, statusText: '制作中', acceptedAt: new Date() },
      }),
      this.prisma.sealOrder.update({
        where: { id: assignment.orderId },
        data: { assignmentStatus: 2 },
      }),
    ]);

    return { message: '接单成功' };
  }

  /** 网点完成制作 → 标记为"已发货" */
  async completeOrder(assignmentId: string, outletId: string) {
    const assignment = await this.prisma.orderAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('分配记录不存在');
    if (assignment.outletId !== outletId) throw new BadRequestException('无权操作此订单');
    if (assignment.status !== 2) throw new BadRequestException('当前状态无法完成制作');

    await this.prisma.$transaction([
      this.prisma.orderAssignment.update({
        where: { id: assignmentId },
        data: { status: 3, statusText: '已发货', completedAt: new Date() },
      }),
      this.prisma.sealOrder.update({
        where: { id: assignment.orderId },
        data: { assignmentStatus: 3, status: 4, statusText: '已发货' },
      }),
    ]);

    return { message: '已标记为已发货' };
  }
}
