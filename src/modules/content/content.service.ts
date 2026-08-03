// @ts-nocheck
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toCamelDeep(obj: any): any {
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)])
    );
  }
  return obj;
}

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  // ==================== Banner ====================
  async listBanners() {
    const list = await this.prisma.content_banners.findMany({
      orderBy: [{ sort: 'asc' }, { created_at: 'desc' }],
    });
    return toCamelDeep(list);
  }

  async createBanner(data: { title: string; image: string; link?: string; sort?: number; status?: number }) {
    const banner = await this.prisma.content_banners.create({ data });
    return toCamelDeep(banner);
  }

  async updateBanner(id: string, data: Partial<{ title: string; image: string; link: string; sort: number; status: number }>) {
    const banner = await this.prisma.content_banners.update({ where: { id }, data });
    return toCamelDeep(banner);
  }

  async deleteBanner(id: string) {
    await this.prisma.content_banners.delete({ where: { id } });
    return { success: true };
  }

  // ==================== Announcement ====================
  async listAnnouncements(query?: { status?: string | number; keyword?: string }) {
    const where: any = {};
    if (query?.status !== undefined && query.status !== '' && query.status !== null) {
      where.status = Number(query.status);
    }
    if (query?.keyword) {
      where.OR = [
        { title: { contains: query.keyword } },
        { content: { contains: query.keyword } },
      ];
    }
    const list = await this.prisma.content_announcements.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return toCamelDeep(list);
  }

  async createAnnouncement(dto: { title: string; content: string; status?: number; publishedAt?: string; expiredAt?: string; operator?: string }) {
    const data: any = {
      title: dto.title,
      content: dto.content,
      status: dto.status ?? 1,
    };
    if (dto.publishedAt !== undefined) data.published_at = dto.publishedAt ? new Date(dto.publishedAt) : null;
    if (dto.expiredAt !== undefined) data.expired_at = dto.expiredAt ? new Date(dto.expiredAt) : null;
    if (dto.operator !== undefined) data.operator = dto.operator;
    const item = await this.prisma.content_announcements.create({ data });
    return toCamelDeep(item);
  }

  async updateAnnouncement(id: string, dto: { title?: string; content?: string; status?: number; publishedAt?: string; expiredAt?: string; operator?: string }) {
    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.publishedAt !== undefined) data.published_at = dto.publishedAt ? new Date(dto.publishedAt) : null;
    if (dto.expiredAt !== undefined) data.expired_at = dto.expiredAt ? new Date(dto.expiredAt) : null;
    if (dto.operator !== undefined) data.operator = dto.operator;
    const item = await this.prisma.content_announcements.update({ where: { id }, data });
    return toCamelDeep(item);
  }

  async deleteAnnouncement(id: string) {
    await this.prisma.content_announcements.delete({ where: { id } });
    return { success: true };
  }

  // ==================== Intro ====================
  async listIntros() {
    const list = await this.prisma.content_intros.findMany({
      orderBy: [{ sort: 'asc' }, { created_at: 'asc' }],
    });
    return toCamelDeep(list);
  }

  async createIntro(data: { title: string; subtitle?: string; image: string; sort?: number; status?: number }) {
    const item = await this.prisma.content_intros.create({ data });
    return toCamelDeep(item);
  }

  async updateIntro(id: string, data: Partial<{ title: string; subtitle: string; image: string; sort: number; status: number }>) {
    const item = await this.prisma.content_intros.update({ where: { id }, data });
    return toCamelDeep(item);
  }

  async deleteIntro(id: string) {
    await this.prisma.content_intros.delete({ where: { id } });
    return { success: true };
  }
}