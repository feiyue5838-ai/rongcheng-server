import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  // ==================== 门店 CRUD ====================

  /** 门店列表 */
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
      this.prisma.store.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.store.count({ where }),
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

  /** 门店详情 */
  async findOne(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('门店不存在');
    return { ...store, password: undefined };
  }

  /** 新增门店 */
  async create(data: { name: string; contact: string; phone: string; province?: string; city?: string; address?: string }) {
    const existing = await this.prisma.store.findUnique({ where: { phone: data.phone } });
    if (existing) throw new BadRequestException('该手机号已被注册');

    const initPassword = Math.random().toString().slice(2, 8);
    const hashed = await bcrypt.hash(initPassword, 10);

    const store = await this.prisma.store.create({
      data: { ...data, password: hashed, status: 1 },
    });

    return { ...store, password: undefined, initPassword };
  }

  /** 编辑门店 */
  async update(id: string, data: { name?: string; contact?: string; phone?: string; province?: string; city?: string; address?: string; status?: number }) {
    if (data.phone) {
      const existing = await this.prisma.store.findFirst({ where: { phone: data.phone, NOT: { id } } });
      if (existing) throw new BadRequestException('该手机号已被其他门店使用');
    }
    const store = await this.prisma.store.update({ where: { id }, data });
    return { ...store, password: undefined };
  }

  /** 删除门店 */
  async remove(id: string) {
    const assignment = await this.prisma.orderAssignment.findFirst({
      where: { storeId: id, status: { in: [1, 2] } },
    });
    if (assignment) throw new BadRequestException('该门店存在未完成的订单，无法删除');

    await this.prisma.store.delete({ where: { id } });
    return { message: '删除成功' };
  }

  /** 重置门店密码 */
  async resetPassword(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('门店不存在');

    const newPassword = Math.random().toString().slice(2, 8);
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.store.update({ where: { id }, data: { password: hashed } });

    return { password: newPassword };
  }

  // ==================== 门店登录 ====================

  /** 门店登录 */
  async storeLogin(phone: string, password: string) {
    const store = await this.prisma.store.findUnique({ where: { phone } });
    if (!store) throw new NotFoundException('门店账号不存在');
    if (store.status === 0) throw new BadRequestException('账号已被禁用，请联系管理员');

    const isMatch = await bcrypt.compare(password, store.password);
    if (!isMatch) throw new BadRequestException('密码错误');

    await this.prisma.store.update({
      where: { id: store.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      store: { ...store, password: undefined },
      requireChangePassword: false,
    };
  }

  /** 修改门店密码 */
  async changePassword(storeId: string, oldPassword: string, newPassword: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('门店不存在');

    const isMatch = await bcrypt.compare(oldPassword, store.password);
    if (!isMatch) throw new BadRequestException('原密码错误');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.store.update({ where: { id: storeId }, data: { password: hashed } });

    return { message: '密码修改成功' };
  }

  // ==================== 门店订单 ====================

  /** 门店订单列表（该门店分配的订单） */
  async getStoreOrders(storeId: string, params: { page?: number; pageSize?: number; status?: number }) {
    const { page = 1, pageSize = 20, status } = params;

    const where: any = { storeId };
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

  /** 门店统计 */
  async getStoreStats(storeId: string) {
    const [pending, processing, completed, todayTotal] = await Promise.all([
      this.prisma.orderAssignment.count({ where: { storeId, status: 1 } }),
      this.prisma.orderAssignment.count({ where: { storeId, status: 2 } }),
      this.prisma.orderAssignment.count({ where: { storeId, status: 3 } }),
      this.prisma.orderAssignment.count({
        where: {
          storeId,
          assignedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return { pending, processing, completed, todayTotal };
  }

  /** 门店接单 */
  async acceptOrder(assignmentId: string, storeId: string) {
    const assignment = await this.prisma.orderAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('分配记录不存在');
    if (assignment.storeId !== storeId) throw new BadRequestException('无权操作此订单');
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

  /** 门店完成制作 → 标记为"已发货" */
  async completeOrder(assignmentId: string, storeId: string) {
    const assignment = await this.prisma.orderAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('分配记录不存在');
    if (assignment.storeId !== storeId) throw new BadRequestException('无权操作此订单');
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
