// V2.0 供应商端通知服务
// 提供：绑定 openid、订阅开关、通知列表/已读/删除
// 通知存 V2.0 notifications 表（target_type='supplier', target_id=supplierId）
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SupplierNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** 绑定微信 openid（接收订阅消息） */
  async bindOpenid(supplierId: string, openid: string) {
    if (!openid) throw new BadRequestException('openid 不能为空');
    // 唯一性校验 — 同一 openid 不能绑定到其他供应商
    const existing = await this.prisma.suppliers.findFirst({
      where: { outlet_openid: openid, NOT: { id: supplierId } },
    });
    if (existing) throw new BadRequestException('该微信号已绑定其他供应商，请先解绑后再试');
    await this.prisma.suppliers.update({
      where: { id: supplierId },
      data: { outlet_openid: openid },
    });
    return { success: true };
  }

  /** 开关订阅消息 */
  async toggleSubscribe(supplierId: string, enabled: boolean) {
    await this.prisma.suppliers.update({
      where: { id: supplierId },
      data: { subscribe_msg: enabled ? 1 : 0 },
    });
    return { success: true, enabled: !!enabled };
  }

  /** 获取我的订阅状态 + 绑定状态 */
  async getSubscribeStatus(supplierId: string) {
    const s = await this.prisma.suppliers.findUnique({
      where: { id: supplierId },
      select: { outlet_openid: true, subscribe_msg: true },
    });
    return {
      bound: !!(s && s.outlet_openid),
      enabled: s ? s.subscribe_msg === 1 : true,
    };
  }

  /** 我的通知列表 */
  async getMyNotifications(
    supplierId: string,
    query: { page?: number; pageSize?: number; unreadOnly?: boolean },
  ) {
    const where: any = {
      targetType: 'supplier',
      targetId: supplierId,
    };
    if (query.unreadOnly) where.isRead = false;

    const [list, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((query.page || 1) - 1) * (query.pageSize || 20),
        take: query.pageSize || 20,
      }),
      this.prisma.notifications.count({ where }),
    ]);

    return {
      list: list.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        type: n.type,
        orderNo: n.targetType === 'order' ? n.targetId : null,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
      unread: await this.prisma.notifications.count({
        where: { ...where, isRead: false },
      }),
    };
  }

  /** 标记已读 */
  async markRead(supplierId: string, notificationId: string) {
    const n = await this.prisma.notifications.findFirst({
      where: { id: notificationId, targetType: 'supplier', targetId: supplierId },
    });
    if (!n) throw new NotFoundException('通知不存在');
    await this.prisma.notifications.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  /** 全部已读 */
  async markAllRead(supplierId: string) {
    await this.prisma.notifications.updateMany({
      where: { targetType: 'supplier', targetId: supplierId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  /** 删除通知 */
  async deleteNotification(supplierId: string, notificationId: string) {
    const n = await this.prisma.notifications.findFirst({
      where: { id: notificationId, targetType: 'supplier', targetId: supplierId },
    });
    if (!n) throw new NotFoundException('通知不存在');
    await this.prisma.notifications.delete({ where: { id: notificationId } });
    return { success: true };
  }
}
