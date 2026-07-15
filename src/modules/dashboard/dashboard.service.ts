import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      todayUsers,
      totalOrders,
      pendingOrders,
      yesterdayApproved,
      totalRevenue,
      todayOrders,
      pendingReviews,
      completedOrders,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.sealOrder.count(),
      this.prisma.sealOrder.count({ where: { status: { in: [2, 3] } } }),
      this.prisma.sealOrder.count({ where: { status: 5, updatedAt: { gte: todayStart } } }),
      this.prisma.sealOrder.aggregate({ _sum: { payPrice: true } }),
      this.prisma.sealOrder.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.review.count({ where: { reply: null } }),
      this.prisma.sealOrder.count({ where: { status: 5 } }),
    ]);

    return {
      totalUsers,
      todayUsers,
      totalOrders,
      pendingOrders,
      yesterdayApproved,
      totalRevenue: Number(totalRevenue._sum.payPrice || 0),
      todayOrders,
      pendingReviews,
      completedOrders,
    };
  }
}
