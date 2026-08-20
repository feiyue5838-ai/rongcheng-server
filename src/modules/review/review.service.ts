import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../wechat/wechat.service';

function snakeToCamel(s) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }
function toCamelDeep(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj instanceof Date) return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)]));
}


@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService, private wechatService: WechatService) {}

  /** 提交评价（小程序端） */
  async submitReview(user_id: string, dto: any, openid?: string) {
    const { order_id, rating, content, images } = dto;

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('请输入 1-5 星评分');
    }
    if (!content || content.trim().length < 5) {
      throw new BadRequestException('评价内容至少 5 个字符');
    }

    // 内容安全检测（文本）
    await this.wechatService.checkTextSecurity(content.trim(), 2, openid);

    // 内容安全检测（图片，异步提交）
    if (images && images.length) {
      for (const img of images) {
        if (typeof img === 'string' && /^https?:\/\//.test(img)) {
          await this.wechatService.checkImageSecurity(img, 2, openid);
        }
      }
    }

    // 验证订单归属且已完成
    const order = await this.prisma.seal_orders.findFirst({
      where: { id: order_id, user_id, status: 5 },
    });
    if (!order) throw new BadRequestException('订单不存在或未完成，无法评价');

    // 检查是否已评价
    const existing = await this.prisma.reviews.findFirst({ where: { order_id } });
    if (existing) throw new BadRequestException('该订单已评价');

    return this.prisma.reviews.create({
      data: {
        order_id,
        user_id,
        module: order.module,
        rating,
        content: content.trim(),
        images: images || [],
        status: 'pending', // 默认待审核
      },
      include: {
        user: { select: { nickname: true, avatar: true } },
        seal_orders: { select: { order_no: true, type: true } },
      },
    });
  }

  /** 我的评价列表 */
  async getMyReviews(user_id: string, query: any) {
    const { page = 1, pageSize = 10 } = query;
    const [reviews, total] = await Promise.all([
      this.prisma.reviews.findMany({
        where: { user_id },
        include: {
          user: { select: { nickname: true, avatar: true } },
          seal_orders: { select: { order_no: true, type: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.reviews.count({ where: { user_id } }),
    ]);
    return {
      list: reviews,
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 小程序端：已审核通过的评价列表（公开） */
  async getApprovedReviews(query: any) {
    const { page = 1, pageSize = 10, module } = query;
    const where: any = { status: 'approved' };
    if (module) where.module = module;

    const [reviews, total] = await Promise.all([
      this.prisma.reviews.findMany({
        where,
        include: {
          user: { select: { nickname: true, avatar: true } },
          seal_orders: { select: { order_no: true, type: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.reviews.count({ where }),
    ]);

    // 脱敏手机号
    const list = reviews.map(r => ({
      ...r,
      user: r.user ? {
        ...r.user,
        maskedPhone: null,
      } : null,
    }));

    return {
      list,
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 管理端：评价列表（支持 status 筛选） */
  async adminGetReviews(query: any) {
    const { page = 1, pageSize = 20, module, rating, keyword, status } = query;
    const where: any = {};
    if (module) where.module = module;
    if (rating) where.rating = Number(rating);
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { content: { contains: keyword } },
        { seal_orders: { order_no: { contains: keyword } } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.reviews.findMany({
        where,
        include: {
          user: { select: { nickname: true, avatar: true } },
          seal_orders: { select: { order_no: true, type: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.reviews.count({ where }),
    ]);

    return {
      list: toCamelDeep(reviews),
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 管理端：审核评价 */
  async adminUpdateStatus(reviewId: string, status: string) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException('状态值非法');
    }
    const review = await this.prisma.reviews.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('评价不存在');
    const updated = await this.prisma.reviews.update({ where: { id: reviewId }, data: { status } });
    return toCamelDeep(updated);
  }

  /** 管理端：回复评价 */
  async adminReplyReview(reviewId: string, reply: string) {
    const review = await this.prisma.reviews.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('评价不存在');
    return toCamelDeep(await this.prisma.reviews.update({
      where: { id: reviewId },
      data: { reply, reply_at: new Date() },
    }));
  }

  /** 管理端：删除评价 */
  async adminDeleteReview(reviewId: string) {
    await this.prisma.reviews.delete({ where: { id: reviewId } });
    return { success: true };
  }
}
