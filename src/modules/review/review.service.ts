import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  /** 提交评价 */
  async submitReview(userId: string, dto: any) {
    const { orderId, rating, content, images } = dto;

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('请输入 1-5 星评分');
    }
    if (!content || content.length < 5) {
      throw new BadRequestException('评价内容至少 5 个字符');
    }

    // 验证订单归属
    const order = await this.prisma.sealOrder.findFirst({
      where: { id: orderId, userId, status: 5 },
    });
    if (!order) throw new BadRequestException('订单不存在或未完成，无法评价');

    // 检查是否已评价
    const existing = await this.prisma.review.findFirst({ where: { orderId } });
    if (existing) throw new BadRequestException('该订单已评价');

    return this.prisma.review.create({
      data: { orderId, userId, module: order.module, rating, content, images: images || [] },
      include: { user: { select: { nickname: true, avatar: true } } },
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
    return { list: reviews, pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } };
  }

  /** 管理端：评价列表 */
  async adminGetReviews(query: any) {
    const { page = 1, pageSize = 20, module, rating, keyword } = query;
    const where: any = {};
    if (module) where.module = module;
    if (rating) where.rating = Number(rating);
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
          user: { select: { nickname: true, phone: true } },
          order: { select: { orderNo: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.review.count({ where }),
    ]);

    return { list: reviews, pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } };
  }

  /** 管理端：回复评价 */
  async adminReplyReview(reviewId: string, reply: string) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { reply, replyAt: new Date() },
    });
  }

  /** 管理端：删除评价 */
  async adminDeleteReview(reviewId: string) {
    return this.prisma.review.delete({ where: { id: reviewId } });
  }
}
