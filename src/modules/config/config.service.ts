// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });
    return config ? JSON.parse(config.value) : null;
  }

  async setConfig(key: string, value: any, name?: string) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    return this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: stringValue, name: name || key },
      update: { value: stringValue },
    });
  }

  async getAllConfigs(group?: string) {
    const where: any = { status: 1 };
    if (group) where.group = group;
    return this.prisma.systemConfig.findMany({ where, orderBy: { sort: 'asc' } });
  }
}
