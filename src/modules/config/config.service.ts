// @ts-nocheck
import { Injectable } from '@nestjs/common';
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
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(key: string) {
    if (!key) return null;
    const config = await this.prisma.system_configs.findUnique({ where: { key } });
    if (!config) return null;
    const c = toCamelDeep(config);
    c.value = this._parseValue(c.valueType, c.value);
    return c;
  }

  async setConfig(key: string, value: any, name?: string, group?: string) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const upserted = await this.prisma.system_configs.upsert({
      where: { key },
      create: { key, value: stringValue, name: name || key, group: group || 'default' },
      update: { value: stringValue, ...(group ? { group } : {}) },
    });
    return toCamelDeep(upserted);
  }

  private _parseValue(valueType: string, value: string): any {
    if (valueType === 'json' || valueType === 'array') {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  }

  async getAllConfigs(group?: string) {
    const where: any = { status: 1 };
    if (group) where.group = group;
    const rows = await this.prisma.system_configs.findMany({ where, orderBy: { sort: 'asc' } });
    return rows.map((r: any) => {
      const c = toCamelDeep(r);
      c.value = this._parseValue(c.valueType, c.value);
      return c;
    });
  }
}
