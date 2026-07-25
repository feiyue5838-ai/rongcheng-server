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
      this.prisma.admin.findMany({
        where,
        select: { id: true, username: true, nickname: true, role: true, status: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.admin.count({ where }),
    ]);
    return { list: admins, pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } };
  }

  /** 创建管理员 */
  async createAdmin(dto: any) {
    const existing = await this.prisma.admin.findUnique({ where: { username: dto.username } });
    if (existing) throw new BadRequestException('用户名已存在');
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    // ⚠ 白名单字段：拒绝 role / permissions / status 来自客户端
    return this.prisma.admin.create({
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
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('管理员不存在');
    // ⚠ 白名单字段：只允许更新 nickname / password
    const data: any = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    return this.prisma.admin.update({ where: { id }, data });
  }

  /** 删除管理员 */
  async deleteAdmin(id: string) {
    return this.prisma.admin.delete({ where: { id } });
  }

  /** 操作日志 */
  async createLog(
    adminId: string | null,
    module: string,
    action: string,
    target: string,
    detail?: string,
    ip?: string,
    userAgent?: string,
  ) {
    return this.prisma.operationLog.create({
      data: { adminId: adminId || null, module, action, target, detail, ip: ip || null, userAgent: userAgent || null },
    });
  }

  async getLogs(query: any) {
    const { page = 1, pageSize = 20, adminId, module, startDate, endDate } = query;
    const where: any = {};
    if (adminId) where.adminId = adminId;
    if (module) where.module = module;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        include: { admin: { select: { id: true, username: true, nickname: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.operationLog.count({ where }),
    ]);
    return { list: logs, pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } };
  }

  /** 系统总览数据 */
  async getDashboard() {
    const [
      totalUsers, todayUsers, totalOrders, todayOrders,
      pendingOrders, completedOrders, totalRevenue,
      pendingReviews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      this.prisma.sealOrder.count(),
      this.prisma.sealOrder.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      this.prisma.sealOrder.count({ where: { status: 1 } }),
      this.prisma.sealOrder.count({ where: { status: 5 } }),
      this.prisma.sealOrder.aggregate({ _sum: { payPrice: true }, where: { status: { in: [2, 3, 4, 5] } } }),
      this.prisma.review.count({ where: { reply: null } }),
    ]);

    return {
      totalUsers,
      todayUsers,
      totalOrders,
      todayOrders,
      pendingOrders,
      completedOrders,
      totalRevenue: totalRevenue._sum.payPrice || 0,
      pendingReviews,
    };
  }

  async getProfile(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, nickname: true, role: true, permissions: true, status: true, createdAt: true },
    });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }
    return admin;
  }
}
