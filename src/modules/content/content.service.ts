import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
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
function toSnakeDeep(obj: any): any {
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [camelToSnake(k), toSnakeDeep(v)])
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

  async createBanner(data: { id?: any; title: string; image: string; link?: string; sort?: number; status?: number }) {
    const { id, ...rest } = data as any;  // 剔除前端可能传来的 id
    const banner = await this.prisma.content_banners.create({ data: rest });
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
    const [list, total] = await Promise.all([
      this.prisma.content_announcements.findMany({ where, orderBy: { created_at: 'desc' } }),
      this.prisma.content_announcements.count({ where }),
    ]);
    return { list: toCamelDeep(list), pagination: { page: 1, pageSize: 20, total } };
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
  async listIntros(type?: string) {
    const where = type ? { type: { in: [type, 'all'] } } : {};
    const [list, total] = await Promise.all([
      this.prisma.content_intros.findMany({ where, orderBy: [{ sort: 'asc' }, { created_at: 'asc' }] }),
      this.prisma.content_intros.count({ where }),
    ]);
    return { list: toCamelDeep(list), pagination: { page: 1, pageSize: 20, total } };
  }

  async createIntro(data: { title: string; subtitle?: string; image?: string; images?: string[]; type?: string; sort?: number; status?: number }) {
    const { id: _id, createdAt, updatedAt, created_at, updated_at, ...rest } = data as any;
    const cover = (rest.images && rest.images.length) ? rest.images[0] : (rest.image || '');
    const item = await this.prisma.content_intros.create({ data: { ...rest, image: cover, images: rest.images || [], type: rest.type || 'all' } });
    return toCamelDeep(item);
  }

  async updateIntro(id: string, data: Partial<{ title: string; subtitle: string; image?: string; images?: string[]; type: string; sort: number; status: number }>) {
    const { id: _id, createdAt, updatedAt, created_at, updated_at, ...rest } = data as any;
    const patch: any = { ...rest };
    if (rest.images !== undefined) patch.image = (rest.images && rest.images.length) ? rest.images[0] : (rest.image || '');
    const item = await this.prisma.content_intros.update({ where: { id }, data: patch });
    return toCamelDeep(item);
  }

  async deleteIntro(id: string) {
    await this.prisma.content_intros.delete({ where: { id } });
    return { success: true };
  }

  // ==================== About ====================
  async getAbout() {
    // 单条记录，不存在则返回默认空对象
    let item = await this.prisma.content_about.findFirst({ orderBy: { created_at: 'desc' } });
    if (!item) {
      // 首次访问时自动创建一条默认记录
      item = await this.prisma.content_about.create({ data: {} });
    }
    return toCamelDeep(item);
  }

  async saveAbout(
    dto: { appName?: string; phone?: string; wechat?: string; serviceTime?: string; intro?: string; address?: string; copyright?: string; image?: string; logoUrl?: string; version?: string; companyName?: string; termsContent?: string; privacyContent?: string; materialCommitment?: string },
    operator?: string,
  ) {
    const patch: any = toSnakeDeep(dto);
    if (operator) patch.updated_by = operator;
    let item = await this.prisma.content_about.findFirst({ orderBy: { created_at: 'desc' } });
    if (!item) {
      item = await this.prisma.content_about.create({ data: patch });
    } else {
      item = await this.prisma.content_about.update({ where: { id: item.id }, data: patch });
    }
    return toCamelDeep(item);
  }

  async getAgreement(type: string) {
    const item = await this.prisma.content_about.findFirst({ orderBy: { created_at: 'desc' } });
    const record = item ? toCamelDeep(item) : {};
    const field = type === 'privacy' ? 'privacyContent' : 'termsContent';
    return {
      type,
      title: type === 'privacy' ? '隐私政策' : '用户服务协议',
      content: (record as any)[field] || '',
    };
  }

  // ==================== Material Commitment ====================
  async getMaterialCommitment() {
    const item = await this.prisma.content_about.findFirst({ orderBy: { created_at: 'desc' } });
    const record = item ? toCamelDeep(item) : {};
    return {
      title: '材料真实性承诺书',
      content: (record as any)['materialCommitment'] || '',
    };
  }

  async saveMaterialCommitment(content: string, operator?: string) {
    const patch: any = { material_commitment: content };
    if (operator) patch.updated_by = operator;
    let item = await this.prisma.content_about.findFirst({ orderBy: { created_at: 'desc' } });
    if (!item) {
      item = await this.prisma.content_about.create({ data: patch });
    } else {
      item = await this.prisma.content_about.update({ where: { id: item.id }, data: patch });
    }
    return toCamelDeep(item);
  }
}