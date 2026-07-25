// @ts-nocheck
﻿import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /** 管理员列表 */
  async getAdmins(query: any) {
    const { page = 1, pageSize = 20, keyword } = query;
    const where: any = {};
    if (keyword) where.OR = [{ username: { contains: keyword } }, { nickname: { contains: keyword } }];

    const [admins, total] = await Promise.all([
      this.prisma.admins.findMany({
        where,
        select: { id: true, username: true, nickname: true, role: true, status: true, last_login_at: true, created_at: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.admins.count({ where }),
    ]);
    return { list: admins, pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } };
  }

  /** 创建管理员 */
  async createAdmin(dto: any) {
    const existing = await this.prisma.admins.findUnique({ where: { username: dto.username } });
    if (existing) throw new BadRequestException('用户名已存在');
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    // ⚠ 白名单字段：拒绝 role / permissions / status 来自客户端
    return this.prisma.admins.create({
      data: {
        username: dto.username,
        nickname: dto.nickname || null,
        password: hashedPassword,
        role: 'admin',         // 默认角色，不允许客户端指定
        permissions: [],       // 默认空权限
        status: 1,             // 默认启用
      },
    });
  }

  /** 更新管理员 */
  async updateAdmin(id: string, dto: any) {
    const admin = await this.prisma.admins.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('管理员不存在');
    // ⚠ 白名单字段：只允许更新 nickname / password
    const data: any = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    return this.prisma.admins.update({ where: { id }, data });
  }

  /** 删除管理员 */
  async deleteAdmin(id: string) {
    return this.prisma.admins.delete({ where: { id } });
  }

  /** 操作日志 */
  async createLog(
    admin_id: string | null,
    module: string,
    action: string,
    target: string,
    detail?: string,
    ip?: string,
    user_agent?: string,
  ) {
    return this.prisma.operation_logs.create({
      data: { admin_id: admin_id || null, module, action, target, detail, ip: ip || null, user_agent: user_agent || null },
    });
  }

  async getLogs(query: any) {
    const { page = 1, pageSize = 20, admin_id, module, startDate, endDate } = query;
    const where: any = {};
    if (admin_id) where.admin_id = admin_id;
    if (module) where.module = module;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.operation_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.operation_logs.count({ where }),
    ]);
    // 单独查 admins 补回 admin 信息（operation_logs.admin_id 无 Prisma 关系）
    const adminIds = [...new Set(logs.map((l: any) => l.admin_id).filter(Boolean))];
    let adminMap: Record<string, any> = {};
    if (adminIds.length) {
      const admins = await this.prisma.admins.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, username: true, nickname: true },
      });
      adminMap = Object.fromEntries(admins.map(a => [a.id, a]));
    }
    const list = logs.map((l: any) => ({ ...l, admin: adminMap[l.admin_id] || null }));
    return { list, pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } };
  }

  /** 系统总览数据 */
  async getDashboard() {
    const [
      totalUsers, todayUsers, total_orders, todayOrders,
      pendingOrders, completedOrders, totalRevenue,
      pendingReviews,
    ] = await Promise.all([
      this.prisma.users.count(),
      this.prisma.users.count({ where: { created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      this.prisma.seal_orders.count(),
      this.prisma.seal_orders.count({ where: { created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      this.prisma.seal_orders.count({ where: { status: 1 } }),
      this.prisma.seal_orders.count({ where: { status: 5 } }),
      this.prisma.seal_orders.aggregate({ _sum: { pay_price: true }, where: { status: { in: [2, 3, 4, 5] } } }),
      this.prisma.reviews.count({ where: { reply: null } }),
    ]);

    return {
      totalUsers,
      todayUsers,
      total_orders,
      todayOrders,
      pendingOrders,
      completedOrders,
      totalRevenue: totalRevenue._sum.pay_price || 0,
      pendingReviews,
    };
  }

  async getProfile(admin_id: string) {
    const admin = await this.prisma.admins.findUnique({
      where: { id: admin_id },
      select: { id: true, username: true, nickname: true, role: true, permissions: true, status: true, created_at: true },
    });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }
    return admin;
  }
}
