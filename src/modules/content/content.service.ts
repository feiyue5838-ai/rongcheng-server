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
  async listAnnouncements() {
    const list = await this.prisma.content_announcements.findMany({
      orderBy: { created_at: 'desc' },
    });
    return toCamelDeep(list);
  }

  async createAnnouncement(data: { title: string; content: string; status?: number }) {
    const item = await this.prisma.content_announcements.create({ data });
    return toCamelDeep(item);
  }

  async updateAnnouncement(id: string, data: Partial<{ title: string; content: string; status: number }>) {
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