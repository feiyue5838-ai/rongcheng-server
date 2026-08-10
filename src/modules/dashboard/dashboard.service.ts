// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function snakeToCamel(s: string): string {
  if (s.startsWith('_')) return s;
  return s.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toCamelDeep(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj instanceof Date) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)]),
  );
}

// 北京时间辅助
function getBeijingNow(): Date {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function todayBeijingUTC(): Date {
  const bj = getBeijingNow();
  const localToday = new Date(bj.getFullYear(), bj.getMonth(), bj.getDate());
  return new Date(localToday.getTime() - 8 * 3600 * 1000);
}

function dateBeijingUTC(n: number): Date {
  const bj = getBeijingNow();
  const d = new Date(bj.getFullYear(), bj.getMonth(), bj.getDate() - n);
  return new Date(d.getTime() - 8 * 3600 * 1000);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const todayStart = todayBeijingUTC();

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
      // 收入（刻章/代理记账用 pay_price，登报用 total_price）
      sealRevenue,
      newspaperRevenue,
      bookkeepingRevenue,
      // 待回复评价
      pendingReviews,
      // 客户统计
      totalCustomers,
      activeCustomers,
      silentCustomers,
      vipCustomersRaw,
    ] = await Promise.all([
      // 用户
      this.prisma.users.count(),
      this.prisma.users.count({ where: { created_at: { gte: todayStart } } }),
      // 订单总数
      this.prisma.seal_orders.count({ where: { module: 'seal' } }),
      this.prisma.seal_orders.count({ where: { module: 'newspaper' } }),
      this.prisma.seal_orders.count({ where: { module: 'bookkeeping' } }),
      // 待处理：仅 status=2（已支付/待分配/待开工），排除已发货(3)、已完成(5)、已取消(6)等
      this.prisma.seal_orders.count({ where: { module: 'seal', status: 2 } }),
      this.prisma.seal_orders.count({ where: { module: 'newspaper', status: 2 } }),
      this.prisma.seal_orders.count({ where: { module: 'bookkeeping', status: 2 } }),
      // 今日新增
      this.prisma.seal_orders.count({ where: { module: 'seal', created_at: { gte: todayStart } } }),
      this.prisma.seal_orders.count({ where: { module: 'newspaper', created_at: { gte: todayStart } } }),
      this.prisma.seal_orders.count({ where: { module: 'bookkeeping', created_at: { gte: todayStart } } }),
      // 已完成（status 5）
      this.prisma.seal_orders.count({ where: { module: 'seal', status: 5 } }),
      this.prisma.seal_orders.count({ where: { module: 'newspaper', status: 5 } }),
      this.prisma.seal_orders.count({ where: { module: 'bookkeeping', status: 5 } }),
      // 收入（已支付订单）
      this.prisma.seal_orders.aggregate({
        where: { module: 'seal', status: { gte: 2 } },
        _sum: { total_price: true },
      }),
      this.prisma.seal_orders.aggregate({
        where: { module: 'newspaper', status: { gte: 2 } },
        _sum: { total_price: true },
      }),
      this.prisma.seal_orders.aggregate({
        where: { module: 'bookkeeping', status: { gte: 2 } },
        _sum: { pay_price: true },
      }),
      // 待回复评价
      this.prisma.reviews.count({ where: { reply: null } }),
      // 客户统计
      this.prisma.users.count(),
      // 活跃客户：7天内有订单
      this.prisma.users.count({
        where: { seal_orders: { some: { created_at: { gte: dateBeijingUTC(7) } } } },
      }),
      // 沉默客户：有订单历史但7天内无新单（从未下单的归入"从未下单"不在此处）
      this.prisma.users.count({
        where: {
          seal_orders: { some: { created_at: { lt: dateBeijingUTC(7) } } },
          NOT: { seal_orders: { some: { created_at: { gte: dateBeijingUTC(7) } } } },
        },
      }),
      // VIP客户：累计消费≥500（原始 SQL 结果，取 [0].count）
      this.prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM (
          SELECT user_id FROM seal_orders WHERE status >= 2 GROUP BY user_id
          HAVING SUM(CASE WHEN module = 'bookkeeping' THEN pay_price ELSE total_price END) >= 500
        ) AS vip_users
      `,
    ]);

    // $queryRaw 返回数组 [{ count: N }]
    const vipCustomers = Array.isArray(vipCustomersRaw) ? (vipCustomersRaw[0]?.count ?? 0) : 0;

    const totalOrders = totalSealOrders + totalNewspaperOrders + totalBookkeepingOrders;
    const pendingOrders = pendingSealOrders + pendingNewspaperOrders + pendingBookkeepingOrders;
    const todayOrders = todaySealOrders + todayNewspaperOrders + todayBookkeepingOrders;
    const completedOrders = completedSealOrders + completedNewspaperOrders + completedBookkeepingOrders;
    const totalRevenue =
      Number(sealRevenue._sum.total_price || 0) +
      Number(newspaperRevenue._sum?.total_price || 0) +
      Number(bookkeepingRevenue._sum?.pay_price || 0);

    return toCamelDeep({
      total_users: totalUsers,
      today_users: todayUsers,
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      today_orders: todayOrders,
      pending_reviews: pendingReviews,
      completed_orders: completedOrders,
      // 客户统计
      total_customers: totalCustomers,
      active_customers: activeCustomers,
      silent_customers: silentCustomers,
      vip_customers: vipCustomers,
      // 明细（方便前端拆分展示）
      _detail: {
        seal_orders: totalSealOrders,
        newspaper_orders: totalNewspaperOrders,
        bookkeeping_orders: totalBookkeepingOrders,
        pending_seal_orders: pendingSealOrders,
        pending_newspaper_orders: pendingNewspaperOrders,
        pending_bookkeeping_orders: pendingBookkeepingOrders,
        today_seal_orders: todaySealOrders,
        today_newspaper_orders: todayNewspaperOrders,
        today_bookkeeping_orders: todayBookkeepingOrders,
        completed_seal_orders: completedSealOrders,
        completed_newspaper_orders: completedNewspaperOrders,
        completed_bookkeeping_orders: completedBookkeepingOrders,
        seal_revenue: Number(sealRevenue._sum.total_price || 0),
        newspaper_revenue: Number(newspaperRevenue._sum?.total_price || 0),
        bookkeeping_revenue: Number(bookkeepingRevenue._sum?.pay_price || 0),
      },
    });
  }

  // 近N天趋势数据（订单量或金额）
  async getTrend(type: 'order' | 'amount' = 'order', days: number = 7) {
    const dates: string[] = [];
    const sealData: number[] = [];
    const newspaperData: number[] = [];
    const bookkeepingData: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const bj = getBeijingNow();
      const d = new Date(bj.getFullYear(), bj.getMonth(), bj.getDate() - i);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      dates.push(dateStr);

      const dayStart = dateBeijingUTC(i);
      const dayEnd = dateBeijingUTC(i - 1);

      if (type === 'order') {
        const [sealCount, newspaperCount, bookkeepingCount] = await Promise.all([
          this.prisma.seal_orders.count({
            where: { module: 'seal', created_at: { gte: dayStart, lt: dayEnd } },
          }),
          this.prisma.seal_orders.count({
            where: { module: 'newspaper', created_at: { gte: dayStart, lt: dayEnd } },
          }),
          this.prisma.seal_orders.count({
            where: { module: 'bookkeeping', created_at: { gte: dayStart, lt: dayEnd } },
          }),
        ]);
        sealData.push(sealCount);
        newspaperData.push(newspaperCount);
        bookkeepingData.push(bookkeepingCount);
      } else {
        const [sealSum, newspaperSum, bookkeepingSum] = await Promise.all([
          this.prisma.seal_orders.aggregate({
            where: { module: 'seal', status: { gte: 2 }, created_at: { gte: dayStart, lt: dayEnd } },
            _sum: { total_price: true },
          }),
          this.prisma.seal_orders.aggregate({
            where: { module: 'newspaper', status: { gte: 2 }, created_at: { gte: dayStart, lt: dayEnd } },
            _sum: { total_price: true },
          }),
          this.prisma.seal_orders.aggregate({
            where: { module: 'bookkeeping', status: { gte: 2 }, created_at: { gte: dayStart, lt: dayEnd } },
            _sum: { pay_price: true },
          }),
        ]);
        sealData.push(Math.round(Number(sealSum._sum?.total_price ?? 0) * 100) / 100);
        newspaperData.push(Math.round(Number(newspaperSum._sum?.total_price ?? 0) * 100) / 100);
        bookkeepingData.push(Math.round(Number(bookkeepingSum._sum?.pay_price ?? 0) * 100) / 100);
      }
    }

    return toCamelDeep({
      dates,
      seal: sealData,
      newspaper: newspaperData,
      bookkeeping: bookkeepingData,
    });
  }

  async customerAction(dto: { action: string; segment: string }) {
    const segment = dto.segment;
    const d7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    let count = 0;
    if (segment === 'active') {
      count = await this.prisma.users.count({
        where: { seal_orders: { some: { created_at: { gte: d7 } } } },
      });
    } else if (segment === 'silent') {
      count = await this.prisma.users.count({
        where: {
          seal_orders: { some: { created_at: { lt: d7 } } },
          NOT: { seal_orders: { some: { created_at: { gte: d7 } } } },
        },
      });
    } else if (segment === 'vip') {
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT COUNT(*)::int AS count FROM (
          SELECT user_id FROM seal_orders WHERE status >= 2
          GROUP BY user_id
          HAVING SUM(CASE WHEN module='bookkeeping' THEN pay_price ELSE total_price END) >= 500
        ) AS vip_users`;
      count = Number(rows[0]?.count ?? 0);
    }
    // TODO: 接入微信订阅消息/模板消息，向该 segment 客户批量推送
    return { success: true, action: dto.action, segment, count };
  }
}
