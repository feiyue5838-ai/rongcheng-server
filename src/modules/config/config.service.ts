// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(key: string) {
    if (!key) return null;
    const config = await this.prisma.system_configs.findUnique({ where: { key } });
    return config ? JSON.parse(config.value) : null;
  }

  async setConfig(key: string, value: any, name?: string) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    return this.prisma.system_configs.upsert({
      where: { key },
      create: { key, value: stringValue, name: name || key },
      update: { value: stringValue },
    });
  }

  async getAllConfigs(group?: string) {
    const where: any = { status: 1 };
    if (group) where.group = group;
    return this.prisma.system_configs.findMany({ where, orderBy: { sort: 'asc' } });
  }
}
