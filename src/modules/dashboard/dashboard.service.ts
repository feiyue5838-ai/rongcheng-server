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
      // 订单统计（刻章 + 登报 + 代理记账，module 区分）
      totalSealOrders,
      totalNewspaperOrders,
      totalBookkeepingOrders,
      pendingSealOrders,
      pendingNewspaperOrders,
      pendingBookkeepingOrders,
      todaySealOrders,
      todayNewspaperOrders,
      todayBookkeepingOrders,
      completedSealOrders,
      completedNewspaperOrders,
      completedBookkeepingOrders,
      // 收入（刻章/代理记账用 payPrice，登报用 totalPrice）
      sealRevenue,
      newspaperRevenue,
      bookkeepingRevenue,
      // 待回复评价
      pendingReviews,
    ] = await Promise.all([
      // 用户
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      // 订单总数
      this.prisma.sealOrder.count({ where: { module: 'seal' } }),
      this.prisma.sealOrder.count({ where: { module: 'newspaper' } }),
      this.prisma.sealOrder.count({ where: { module: 'bookkeeping' } }),
      // 待处理（status 2=已支付 3=制作中）
      this.prisma.sealOrder.count({ where: { module: 'seal', status: { in: [2, 3] } } }),
      this.prisma.sealOrder.count({ where: { module: 'newspaper', status: { in: [2, 3] } } }),
      this.prisma.sealOrder.count({ where: { module: 'bookkeeping', status: { in: [2, 3] } } }),
      // 今日新增
      this.prisma.sealOrder.count({ where: { module: 'seal', createdAt: { gte: todayStart } } }),
      this.prisma.sealOrder.count({ where: { module: 'newspaper', createdAt: { gte: todayStart } } }),
      this.prisma.sealOrder.count({ where: { module: 'bookkeeping', createdAt: { gte: todayStart } } }),
      // 已完成（status 5）
      this.prisma.sealOrder.count({ where: { module: 'seal', status: 5 } }),
      this.prisma.sealOrder.count({ where: { module: 'newspaper', status: 5 } }),
      this.prisma.sealOrder.count({ where: { module: 'bookkeeping', status: 5 } }),
      // 收入（已支付订单）
      this.prisma.sealOrder.aggregate({
        where: { module: 'seal', status: { gte: 2 } },
        _sum: { payPrice: true },
      }),
      this.prisma.sealOrder.aggregate({
        where: { module: 'newspaper', status: { gte: 2 } },
        _sum: { totalPrice: true },
      }),
      this.prisma.sealOrder.aggregate({
        where: { module: 'bookkeeping', status: { gte: 2 } },
        _sum: { payPrice: true },
      }),
      // 待回复评价
      this.prisma.review.count({ where: { reply: null } }),
    ]);

    const totalOrders = totalSealOrders + totalNewspaperOrders + totalBookkeepingOrders;
    const pendingOrders = pendingSealOrders + pendingNewspaperOrders + pendingBookkeepingOrders;
    const todayOrders = todaySealOrders + todayNewspaperOrders + todayBookkeepingOrders;
    const completedOrders = completedSealOrders + completedNewspaperOrders + completedBookkeepingOrders;
    const totalRevenue =
      Number(sealRevenue._sum.payPrice || 0) +
      Number(newspaperRevenue._sum?.totalPrice || 0) +
      Number(bookkeepingRevenue._sum?.payPrice || 0);

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
        bookkeepingOrders: totalBookkeepingOrders,
        pendingSealOrders,
        pendingNewspaperOrders,
        pendingBookkeepingOrders,
        todaySealOrders,
        todayNewspaperOrders,
        todayBookkeepingOrders,
        completedSealOrders,
        completedNewspaperOrders,
        completedBookkeepingOrders,
        sealRevenue: Number(sealRevenue._sum.payPrice || 0),
        newspaperRevenue: Number(newspaperRevenue._sum?.totalPrice || 0),
        bookkeepingRevenue: Number(bookkeepingRevenue._sum?.payPrice || 0),
      },
    };
  }

  // 近N天趋势数据（订单量或金额）
  async getTrend(type: 'order' | 'amount' = 'order', days: number = 7) {
    const now = new Date();
    const dates: string[] = [];
    const sealData: number[] = [];
    const newspaperData: number[] = [];
    const bookkeepingData: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      dates.push(dateStr);

      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

      if (type === 'order') {
        // 订单量统计
        const [sealCount, newspaperCount, bookkeepingCount] = await Promise.all([
          this.prisma.sealOrder.count({
            where: { module: 'seal', createdAt: { gte: dayStart, lt: dayEnd } },
          }),
          this.prisma.sealOrder.count({
            where: { module: 'newspaper', createdAt: { gte: dayStart, lt: dayEnd } },
          }),
          this.prisma.sealOrder.count({
            where: { module: 'bookkeeping', createdAt: { gte: dayStart, lt: dayEnd } },
          }),
        ]);
        sealData.push(sealCount);
        newspaperData.push(newspaperCount);
        bookkeepingData.push(bookkeepingCount);
      } else {
        // 金额统计（已支付订单，按创建时间统计）
        const [sealSum, newspaperSum, bookkeepingSum] = await Promise.all([
          this.prisma.sealOrder.aggregate({
            where: { module: 'seal', status: { gte: 2 }, createdAt: { gte: dayStart, lt: dayEnd } },
            _sum: { payPrice: true },
          }),
          this.prisma.sealOrder.aggregate({
            where: { module: 'newspaper', status: { gte: 2 }, createdAt: { gte: dayStart, lt: dayEnd } },
            _sum: { totalPrice: true },
          }),
          this.prisma.sealOrder.aggregate({
            where: { module: 'bookkeeping', status: { gte: 2 }, createdAt: { gte: dayStart, lt: dayEnd } },
            _sum: { payPrice: true },
          }),
        ]);
        sealData.push(Math.round(Number(sealSum._sum?.payPrice ?? 0) * 100) / 100);
        newspaperData.push(Math.round(Number(newspaperSum._sum?.totalPrice ?? 0) * 100) / 100);
        bookkeepingData.push(Math.round(Number(bookkeepingSum._sum?.payPrice ?? 0) * 100) / 100);
      }
    }

    return {
      dates,
      seal: sealData,
      newspaper: newspaperData,
      bookkeeping: bookkeepingData,
    };
  }
}
