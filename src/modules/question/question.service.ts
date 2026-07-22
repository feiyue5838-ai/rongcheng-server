import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuestionService {
  constructor(private prisma: PrismaService) {}

  // ===== 小程序端 =====

  /** 提问 */
  async create(userId: string | null, dto: any) {
    const { content, images, module } = dto;
    if (!content || content.trim().length < 5) {
      throw new BadRequestException('问题内容至少 5 个字符');
    }
    if (!content || content.trim().length > 500) {
      throw new BadRequestException('问题内容不超过 500 字');
    }

    let userName = '热心用户';
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) userName = user.nickname || user.realname || user.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '热心用户';
    }

    return this.prisma.question.create({
      data: {
        userId,
        userName,
        content: content.trim(),
        images: images || [],
        module: module || 'seal_biz',
        status: 'pending',
      },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** 公开问答列表（已审核） */
  async getPublicList(query: any) {
    const { page = 1, pageSize = 10, module } = query;
    const where: any = { status: 'approved' };
    if (module) where.module = module;

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          replies: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      list: questions,
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 问答详情 */
  async getDetail(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
    if (!question) throw new NotFoundException('问题不存在');
    return question;
  }

  // ===== 管理端 =====

  /** 管理端：问答列表 */
  async adminList(query: any) {
    const { page = 1, pageSize = 20, module, status, keyword } = query;
    const where: any = {};
    if (module) where.module = module;
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { content: { contains: keyword } },
        { userName: { contains: keyword } },
      ];
    }

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: { replies: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      list: questions,
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 管理端：审核问题 */
  async adminUpdateStatus(id: string, status: string) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException('状态值非法');
    }
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('问题不存在');
    return this.prisma.question.update({ where: { id }, data: { status } });
  }

  /** 管理端：回复问题 */
  async adminReply(id: string, adminId: string, adminName: string, content: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('问题不存在');
    const [reply] = await Promise.all([
      this.prisma.questionReply.create({
        data: { questionId: id, authorType: 'admin', authorId: adminId, authorName: adminName, content },
      }),
      this.prisma.question.update({ where: { id }, data: { replyCount: { increment: 1 } } }),
    ]);
    return reply;
  }

  /** 管理端：删除问题 */
  async adminDelete(id: string) {
    await this.prisma.question.delete({ where: { id } });
    return { success: true };
  }

  /** 管理端：删除回复 */
  async adminDeleteReply(replyId: string) {
    const reply = await this.prisma.questionReply.findUnique({ where: { id: replyId } });
    if (!reply) throw new NotFoundException('回复不存在');
    await Promise.all([
      this.prisma.questionReply.delete({ where: { id: replyId } }),
      this.prisma.question.update({ where: { id: reply.questionId }, data: { replyCount: { decrement: 1 } } }),
    ]);
    return { success: true };
  }
}
