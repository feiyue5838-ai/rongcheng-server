import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// toCamelDeep utility
function toCamelDeep(obj: any): any {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj === 'object' && 's' in obj && 'e' in obj && 'd' in obj) {
    return Number(obj);
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    const camelEntries = entries.map(([k, v]) => {
      const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      return [camelKey, toCamelDeep(v)];
    });
    return Object.fromEntries(camelEntries);
  }
  return obj;
}

@Injectable()
export class OutletPricingService {
  constructor(private prisma: PrismaService) {}

  // 业务类型配置
  static readonly BUSINESS_TYPES = [
    { key: 'seal', label: '刻章', unit: '个/枚' },
    { key: 'newspaper', label: '登报', unit: '期' },
    { key: 'bookkeeping', label: '代理记账', unit: '家' },
  ];

  // ==================== 合作价格配置 ====================

  /** 获取所有网点的合作价格配置 */
  async getAllPricings(params: {
    outletId?: string;
    businessType?: string;
    status?: number;
  }) {
    const where: any = {};
    if (params.outletId) where.outlet_id = params.outletId;
    if (params.businessType) where.business_type = params.businessType;
    if (params.status !== undefined && params.status !== null) {
      where.status = params.status;
    }

    const rows = await this.prisma.outlet_pricing.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    // 联查网点名称
    const outletIds = [...new Set(rows.map(r => r.outlet_id))];
    const outlets = await this.prisma.outlets.findMany({
      where: { id: { in: outletIds } },
      select: { id: true, name: true },
    });
    const outletMap: Record<string, string> = {};
    outlets.forEach(o => { outletMap[o.id] = o.name; });

    return rows.map(r => {
      const item = toCamelDeep(r);
      item.outletName = outletMap[r.outlet_id] || '';
      return item;
    });
  }

  /** 获取单个网点的合作价格配置 */
  async getPricingsByOutlet(outletId: string) {
    const rows = await this.prisma.outlet_pricing.findMany({
      where: { outlet_id: outletId },
      orderBy: { business_type: 'asc' },
    });
    return rows.map(toCamelDeep);
  }

  /** 创建/更新合作价格配置（按网点+业务类型，upsert） */
  async upsertPricing(data: {
    outletId: string;
    businessType: string;
    unit: string;
    priceType: 'fixed' | 'percent';
    priceValue: number;
    status?: number;
    remark?: string;
  }) {
    const row = await this.prisma.outlet_pricing.upsert({
      where: {
        outlet_id_business_type: {
          outlet_id: data.outletId,
          business_type: data.businessType,
        },
      },
      update: {
        unit: data.unit,
        price_type: data.priceType,
        price_value: data.priceValue,
        status: data.status ?? 1,
        remark: data.remark ?? null,
        updated_at: new Date(),
      },
      create: {
        outlet_id: data.outletId,
        business_type: data.businessType,
        unit: data.unit,
        price_type: data.priceType,
        price_value: data.priceValue,
        status: data.status ?? 1,
        remark: data.remark ?? null,
      },
    });
    return toCamelDeep(row);
  }

  /** 删除合作价格配置 */
  async deletePricing(id: string) {
    await this.prisma.outlet_pricing.delete({ where: { id } });
    return { success: true };
  }

  /** 批量删除（按网点ID） */
  async deleteByOutlet(outletId: string) {
    await this.prisma.outlet_pricing.deleteMany({ where: { outlet_id: outletId } });
    return { success: true };
  }

  /** 获取某个网点某种业务类型的单价（结算时用） */
  async getUnitPrice(outletId: string, businessType: string): Promise<number | null> {
    const row = await this.prisma.outlet_pricing.findUnique({
      where: {
        outlet_id_business_type: {
          outlet_id: outletId,
          business_type: businessType,
        },
      },
    });
    if (!row || row.status === 0) return null;
    return Number(row.price_value);
  }
}
