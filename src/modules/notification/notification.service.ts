import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  /** 创建通知（在 autoAssignStore 中调用） */
  async createNotification(data: {
    outletId: string;
    title: string;
    content: string;
    type?: string;
    orderId?: string;
    orderNo?: string;
  }) {
    return this.prisma.outletNotification.create({
      data: {
        outletId: data.outletId,
        title: data.title,
        content: data.content,
        type: data.type || 'order',
        orderId: data.orderId,
        orderNo: data.orderNo,
        isRead: false,
      },
    });
  }

  /** 网点端：获取我的通知（未读优先 + 最近20条） */
  async getMyNotifications(outletId: string) {
    const [list, unreadCount] = await Promise.all([
      this.prisma.outletNotification.findMany({
        where: { outletId },
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.outletNotification.count({
        where: { outletId, isRead: false },
      }),
    ]);

    return {
      list,
      unreadCount,
    };
  }

  /** 网点端：全部标记已读 */
  async markAllRead(outletId: string) {
    await this.prisma.outletNotification.updateMany({
      where: { outletId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  /** 网点端：单条标记已读 */
  async markRead(outletId: string, id: string) {
    await this.prisma.outletNotification.updateMany({
      where: { id, outletId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}
