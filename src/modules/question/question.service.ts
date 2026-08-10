import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toCamelDeep(obj: any): any {
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj !== null && typeof obj === 'object') {
    if (typeof obj.toString === 'function' && !('getTime' in obj)) {
      const str = obj.toString();
      if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)])
    );
  }
  return obj;
}

@Injectable()
export class QuestionService {
  constructor(private prisma: PrismaService) {}

  // ===== 小程序端 =====

  /** 提问 */
  async create(user_id: string | null, dto: any) {
    const { content, images, module } = dto;
    if (!content || content.trim().length < 5) {
      throw new BadRequestException('问题内容至少 5 个字符');
    }
    if (!content || content.trim().length > 500) {
      throw new BadRequestException('问题内容不超过 500 字');
    }

    let user_name = '热心用户';
    if (user_id) {
      const user = await this.prisma.users.findUnique({ where: { id: user_id } });
      if (user) user_name = user.nickname || user.realname || user.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '热心用户';
    }

    return toCamelDeep(await this.prisma.questions.create({
      data: {
        user_id,
        user_name,
        content: content.trim(),
        images: images || [],
        module: module || 'seal_biz',
        status: 'pending',
      },
      include: { question_replies: { orderBy: { created_at: 'asc' } } },
    }));
  }

  /** 公开问答列表（已审核） */
  async getPublicList(query: any) {
    const { page = 1, pageSize = 10, module } = query;
    const where: any = { status: 'approved' };
    if (module) where.module = module;

    const [questions, total] = await Promise.all([
      this.prisma.questions.findMany({
        where,
        include: {
          question_replies: { orderBy: { created_at: 'asc' } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.questions.count({ where }),
    ]);

    return {
      list: toCamelDeep(questions),
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 问答详情 */
  async getDetail(id: string) {
    const question = await this.prisma.questions.findUnique({
      where: { id },
      include: { question_replies: { orderBy: { created_at: 'asc' } } },
    });
    if (!question) throw new NotFoundException('问题不存在');
    return toCamelDeep(question);
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
        { user_name: { contains: keyword } },
      ];
    }

    const [questions, total] = await Promise.all([
      this.prisma.questions.findMany({
        where,
        include: { question_replies: { orderBy: { created_at: 'asc' } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.questions.count({ where }),
    ]);

    return {
      list: toCamelDeep(questions),
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 管理端：审核问题 */
  async adminUpdateStatus(id: string, status: string) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new BadRequestException('状态值非法');
    }
    const question = await this.prisma.questions.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('问题不存在');
    return toCamelDeep(this.prisma.questions.update({ where: { id }, data: { status } }));
  }

  /** 管理端：回复问题 */
  async adminReply(id: string, admin_id: string, adminName: string, content: string) {
    const question = await this.prisma.questions.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('问题不存在');
    const [reply] = await Promise.all([
      this.prisma.question_replies.create({
        data: { question_id: id, author_type: 'admin', author_id: admin_id, author_name: adminName, content },
      }),
      this.prisma.questions.update({ where: { id }, data: { reply_count: { increment: 1 } } }),
    ]);
    return toCamelDeep(reply);
  }

  /** 管理端：删除问题 */
  async adminDelete(id: string) {
    await this.prisma.questions.delete({ where: { id } });
    return { success: true };
  }

  /** 管理端：删除回复 */
  async adminDeleteReply(replyId: string) {
    const reply = await this.prisma.question_replies.findUnique({ where: { id: replyId } });
    if (!reply) throw new NotFoundException('回复不存在');
    await Promise.all([
      this.prisma.question_replies.delete({ where: { id: replyId } }),
      this.prisma.questions.update({ where: { id: reply.question_id }, data: { reply_count: { decrement: 1 } } }),
    ]);
    return { success: true };
  }
}
