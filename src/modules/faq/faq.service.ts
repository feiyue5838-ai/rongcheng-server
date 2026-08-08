// @ts-nocheck
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
export class FaqService {
  constructor(private prisma: PrismaService) {}

  /** 小程序端：启用项 + 分组 + 电话 */
  async getPublicList() {
    const cats = await this.prisma.faq_categories.findMany({ where: { status: 1 }, orderBy: { sort: 'asc' } });
    const faqs = await this.prisma.faqs.findMany({ where: { status: 1 }, orderBy: { sort: 'asc' } });
    const phone = await this.getPhoneValue();
    const categories = cats.map((c) => ({
      ...toCamelDeep(c),
      faqs: faqs.filter((f) => f.category_id === c.id).map((f) => toCamelDeep(f)),
    }));
    return { categories, phone };
  }

  /** 后台：全部（含禁用） */
  async adminList() {
    const cats = await this.prisma.faq_categories.findMany({ orderBy: { sort: 'asc' } });
    const faqs = await this.prisma.faqs.findMany({ orderBy: { sort: 'asc' } });
    const phone = await this.getPhoneValue();
    const categories = cats.map((c) => ({
      ...toCamelDeep(c),
      faqs: faqs.filter((f) => f.category_id === c.id).map((f) => toCamelDeep(f)),
    }));
    return { categories, phone };
  }

  // ===== 分类 =====

  async addCategory(dto: any) {
    const { name, icon, sort } = dto;
    if (!name) throw new BadRequestException('分类名称必填');
    const c = await this.prisma.faq_categories.create({
      data: { name, icon: icon || '', sort: sort || 0, status: 1 },
    });
    return toCamelDeep(c);
  }

  async updateCategory(id: string, dto: any) {
    const c = await this.prisma.faq_categories.findUnique({ where: { id: Number(id) } });
    if (!c) throw new NotFoundException('分类不存在');
    const updated = await this.prisma.faq_categories.update({
      where: { id: Number(id) },
      data: {
        name: dto.name !== undefined ? dto.name : c.name,
        icon: dto.icon !== undefined ? dto.icon : c.icon,
        sort: dto.sort !== undefined ? dto.sort : c.sort,
        status: dto.status !== undefined ? dto.status : c.status,
      },
    });
    return toCamelDeep(updated);
  }

  async deleteCategory(id: string) {
    await this.prisma.faqs.deleteMany({ where: { category_id: Number(id) } });
    await this.prisma.faq_categories.delete({ where: { id: Number(id) } });
    return { success: true };
  }

  async updateCategoryStatus(id: string, status: number) {
    const c = await this.prisma.faq_categories.findUnique({ where: { id: Number(id) } });
    if (!c) throw new NotFoundException('分类不存在');
    const updated = await this.prisma.faq_categories.update({
      where: { id: Number(id) },
      data: { status: Number(status) },
    });
    return toCamelDeep(updated);
  }

  // ===== 问答 =====

  async addFaq(dto: any) {
    const { categoryId, question, answer, sort } = dto;
    if (!categoryId) throw new BadRequestException('所属分类必填');
    if (!question) throw new BadRequestException('问题必填');
    if (!answer) throw new BadRequestException('答案必填');
    const f = await this.prisma.faqs.create({
      data: { category_id: Number(categoryId), question, answer, sort: sort || 0, status: 1 },
    });
    return toCamelDeep(f);
  }

  async updateFaq(id: string, dto: any) {
    const f = await this.prisma.faqs.findUnique({ where: { id: Number(id) } });
    if (!f) throw new NotFoundException('问答不存在');
    const updated = await this.prisma.faqs.update({
      where: { id: Number(id) },
      data: {
        category_id: dto.categoryId !== undefined ? Number(dto.categoryId) : f.category_id,
        question: dto.question !== undefined ? dto.question : f.question,
        answer: dto.answer !== undefined ? dto.answer : f.answer,
        sort: dto.sort !== undefined ? dto.sort : f.sort,
        status: dto.status !== undefined ? dto.status : f.status,
      },
    });
    return toCamelDeep(updated);
  }

  async deleteFaq(id: string) {
    await this.prisma.faqs.delete({ where: { id: Number(id) } });
    return { success: true };
  }

  async updateFaqStatus(id: string, status: number) {
    const f = await this.prisma.faqs.findUnique({ where: { id: Number(id) } });
    if (!f) throw new NotFoundException('问答不存在');
    const updated = await this.prisma.faqs.update({
      where: { id: Number(id) },
      data: { status: Number(status) },
    });
    return toCamelDeep(updated);
  }

  // ===== 电话（存 system_configs） =====

  async getPhoneValue(): Promise<string> {
    try {
      const r = await this.prisma.system_configs.findUnique({ where: { key: 'service_phone' } });
      return r ? r.value : '4008886666';
    } catch (e) {
      return '4008886666';
    }
  }

  async setPhone(phone: string) {
    if (!phone) throw new BadRequestException('电话必填');
    await this.prisma.system_configs.upsert({
      where: { key: 'service_phone' },
      create: { key: 'service_phone', value: phone, value_type: 'string', group: 'service' },
      update: { value: phone },
    });
    return { phone };
  }
}
