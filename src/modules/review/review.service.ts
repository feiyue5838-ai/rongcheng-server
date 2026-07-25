// @ts-nocheck
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  /** 提交评价（小程序端） */
  async submitReview(userId: string, dto: any) {
    const { orderId, rating, content, images } = dto;

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('请输入 1-5 星评分');
    }
    if (!content || content.trim().length < 5) {
      throw new BadRequestException('评价内容至少 5 个字符');
    }

    // 验证订单归属且已完成
    const order = await this.prisma.sealOrder.findFirst({
      where: { id: orderId, userId, status: 5 },
    });
    if (!order) throw new BadRequestException('订单不存在或未完成，无法评价');

    // 检查是否已评价
    const existing = await this.prisma.review.findFirst({ where: { orderId } });
    if (existing) throw new BadRequestException('该订单已评价');

    return this.prisma.review.create({
      data: {
        orderId,
        userId,
        module: order.module,
        rating,
        content: content.trim(),
        images: images || [],
        status: 'pending', // 默认待审核
      },
      include: {
        user: { select: { nickname: true, avatar: true } },
        order: { select: { orderNo: true, type: true } },
      },
    });
  }

  /** 我的评价列表 */
  async getMyReviews(userId: string, query: any) {
    const { page = 1, pageSize = 10 } = query;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        include: {
          user: { select: { nickname: true, avatar: true } },
          order: { select: { orderNo: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.review.count({ where: { userId } }),
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
      this.prisma.review.findMany({
        where,
        include: {
          user: { select: { nickname: true, avatar: true } },
          order: { select: { orderNo: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.review.count({ where }),
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
        { order: { orderNo: { contains: keyword } } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          user: { select: { nickname: true, phone: true, avatar: true } },
          order: { select: { orderNo: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      list: reviews,
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 管理端：审核评价 */
  async adminUpdateStatus(reviewId: string, status: string) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException('状态值非法');
    }
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('评价不存在');
    return this.prisma.review.update({ where: { id: reviewId }, data: { status } });
  }

  /** 管理端：回复评价 */
  async adminReplyReview(reviewId: string, reply: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('评价不存在');
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { reply, replyAt: new Date() },
    });
  }

  /** 管理端：删除评价 */
  async adminDeleteReview(reviewId: string) {
    await this.prisma.review.delete({ where: { id: reviewId } });
    return { success: true };
  }
}
