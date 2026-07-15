import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NewspaperService {
  constructor(private prisma: PrismaService) {}

  /** 获取分类 */
  async getCategories() {
    return this.prisma.newspaperCategory.findMany({
      where: { status: 1 },
      orderBy: { sort: 'asc' },
    });
  }

  /** 获取报纸列表 */
  async getNewspapers(query: any) {
    const { province, city, level, categoryId } = query;
    const where: any = { status: 1 };
    if (province) where.province = province;
    if (city) where.city = city;
    if (level) where.level = Number(level);
    if (categoryId) where.categoryId = categoryId;

    return this.prisma.newspaper.findMany({
      where,
      include: { category: true },
      orderBy: { sort: 'asc' },
    });
  }

  /** 获取报纸下的模板 */
  async getTemplates(newspaperId?: string, categoryId?: string) {
    const where: any = { status: 1 };
    if (newspaperId) where.newspaperId = newspaperId;
    if (categoryId) where.categoryId = categoryId;

    return this.prisma.newspaperTemplate.findMany({
      where,
      include: {
        newspaper: true,
        category: true,
      },
      orderBy: { sort: 'asc' },
    });
  }

  /** 计算登报价格 */
  async calculatePrice(newspaperId: string, contentLength: number) {
    const newspaper = await this.prisma.newspaper.findUnique({ where: { id: newspaperId } });
    if (!newspaper) return null;

    const words = Math.max(contentLength, newspaper.minWords);
    const price = words * Number(newspaper.pricePerWord);
    return { words, unitPrice: newspaper.pricePerWord, totalPrice: price };
  }

  // 管理端
  async adminCreateCategory(dto: any) {
    return this.prisma.newspaperCategory.create({ data: dto });
  }

  async adminUpdateCategory(id: string, dto: any) {
    return this.prisma.newspaperCategory.update({ where: { id }, data: dto });
  }

  async adminDeleteCategory(id: string) {
    return this.prisma.newspaperCategory.delete({ where: { id } });
  }

  async adminCreateNewspaper(dto: any) {
    return this.prisma.newspaper.create({ data: dto });
  }

  async adminUpdateNewspaper(id: string, dto: any) {
    return this.prisma.newspaper.update({ where: { id }, data: dto });
  }

  async adminDeleteNewspaper(id: string) {
    return this.prisma.newspaper.delete({ where: { id } });
  }

  async adminCreateTemplate(dto: any) {
    return this.prisma.newspaperTemplate.create({ data: dto });
  }

  async adminUpdateTemplate(id: string, dto: any) {
    return this.prisma.newspaperTemplate.update({ where: { id }, data: dto });
  }

  async adminDeleteTemplate(id: string) {
    return this.prisma.newspaperTemplate.delete({ where: { id } });
  }
}
