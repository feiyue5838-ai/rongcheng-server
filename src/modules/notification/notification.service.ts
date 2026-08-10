import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  /** 创建通知（在 autoAssignStore 中调用） */
  async createNotification(data: {
    outlet_id: string;
    title: string;
    content: string;
    type?: string;
    order_id?: string;
    order_no?: string;
  }) {
    return this.prisma.outlet_notifications.create({
      data: {
        outlet_id: data.outlet_id,
        title: data.title,
        content: data.content,
        type: data.type || 'order',
        order_id: data.order_id,
        order_no: data.order_no,
        is_read: false,
      },
    });
  }

  /** 网点端：获取我的通知（未读优先 + 最近20条） */
  async getMyNotifications(outlet_id: string) {
    const [list, unreadCount] = await Promise.all([
      this.prisma.outlet_notifications.findMany({
        where: { outlet_id },
        orderBy: [{ is_read: 'asc' }, { created_at: 'desc' }],
        take: 20,
      }),
      this.prisma.outlet_notifications.count({
        where: { outlet_id, is_read: false },
      }),
    ]);

    return {
      list,
      unreadCount,
    };
  }

  /** 网点端：全部标记已读 */
  async markAllRead(outlet_id: string) {
    await this.prisma.outlet_notifications.updateMany({
      where: { outlet_id, is_read: false },
      data: { is_read: true },
    });
    return { success: true };
  }

  /** 网点端：单条标记已读 */
  async markRead(outlet_id: string, id: string) {
    await this.prisma.outlet_notifications.updateMany({
      where: { id, outlet_id, is_read: false },
      data: { is_read: true },
    });
    return { success: true };
  }
}
