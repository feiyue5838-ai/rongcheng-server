import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      // 用户统计
      totalUsers,
      todayUsers,
      // 订单统计（刻章 + 登报，module 区分）
      totalSealOrders,
      totalNewspaperOrders,
      pendingSealOrders,
      pendingNewspaperOrders,
      todaySealOrders,
      todayNewspaperOrders,
      completedSealOrders,
      completedNewspaperOrders,
      // 收入（刻章用 payPrice，登报用 totalPrice）
      sealRevenue,
      newspaperRevenue,
      // 待回复评价
      pendingReviews,
    ] = await Promise.all([
      // 用户
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      // 刻章订单总数
      this.prisma.sealOrder.count({ where: { module: 'seal' } }),
      // 登报订单总数
      this.prisma.sealOrder.count({ where: { module: 'newspaper' } }),
      // 刻章待处理（status 2=已支付制作中 3=制作中）
      this.prisma.sealOrder.count({ where: { module: 'seal', status: { in: [2, 3] } } }),
      // 登报待处理
      this.prisma.sealOrder.count({ where: { module: 'newspaper', status: { in: [2, 3] } } }),
      // 刻章今日新增
      this.prisma.sealOrder.count({ where: { module: 'seal', createdAt: { gte: todayStart } } }),
      // 登报今日新增
      this.prisma.sealOrder.count({ where: { module: 'newspaper', createdAt: { gte: todayStart } } }),
      // 刻章已完成（status 5）
      this.prisma.sealOrder.count({ where: { module: 'seal', status: 5 } }),
      // 登报已完成
      this.prisma.sealOrder.count({ where: { module: 'newspaper', status: 5 } }),
      // 刻章收入（已支付订单的 payPrice）
      this.prisma.sealOrder.aggregate({
        where: { module: 'seal', status: { gte: 2 } },
        _sum: { payPrice: true },
      }),
      // 登报收入（已支付订单的 totalPrice）
      this.prisma.sealOrder.aggregate({
        where: { module: 'newspaper', status: { gte: 2 } },
        _sum: { totalPrice: true },
      }),
      // 待回复评价
      this.prisma.review.count({ where: { reply: null } }),
    ]);

    const totalOrders = totalSealOrders + totalNewspaperOrders;
    const pendingOrders = pendingSealOrders + pendingNewspaperOrders;
    const todayOrders = todaySealOrders + todayNewspaperOrders;
    const completedOrders = completedSealOrders + completedNewspaperOrders;
    const totalRevenue =
      Number(sealRevenue._sum.payPrice || 0) +
      Number(newspaperRevenue._sum?.totalPrice || 0);

    return {
      totalUsers,
      todayUsers,
      totalOrders,
      pendingOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      todayOrders,
      pendingReviews,
      completedOrders,
      // 明细（方便前端拆分展示）
      _detail: {
        sealOrders: totalSealOrders,
        newspaperOrders: totalNewspaperOrders,
        pendingSealOrders,
        pendingNewspaperOrders,
        todaySealOrders,
        todayNewspaperOrders,
        completedSealOrders,
        completedNewspaperOrders,
        sealRevenue: Number(sealRevenue._sum.payPrice || 0),
        newspaperRevenue: Number(newspaperRevenue._sum?.totalPrice || 0),
      },
    };
  }
}
