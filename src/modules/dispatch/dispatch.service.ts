import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { provincesMatch } from '../../common/utils';

@Injectable()
export class DispatchService {
  constructor(private prisma: PrismaService) {}

  // ── 全局配置 ──────────────────────────────────────
  async getConfig() {
    let cfg = await this.prisma.dispatch_config.findFirst();
    if (!cfg) {
      cfg = await this.prisma.dispatch_config.create({
        data: { mode: 'hybrid', auto_assign: true, business_type_filter: true }
      });
    }
    return cfg;
  }

  async updateConfig(dto: { mode?: string; auto_assign?: boolean; business_type_filter?: boolean }, adminId?: string) {
    const cfg = await this.getConfig();
    return this.prisma.dispatch_config.update({
      where: { id: cfg.id },
      data: { ...dto, updated_by: adminId }
    });
  }

  // ── 网点优先级 ───────────────────────────────────
  async getPriorities() {
    return this.prisma.outlet_priority.findMany({
      include: { outlet: { select: { id: true, name: true, province: true, city: true, status: true } } },
      orderBy: { priority: 'desc' }
    });
  }

  async setPriority(outlet_id: string, priority: number, remark?: string) {
    const outlet = await this.prisma.outlets.findUnique({ where: { id: outlet_id } });
    if (!outlet) throw new NotFoundException('网点不存在');
    return this.prisma.outlet_priority.upsert({
      where: { outlet_id },
      update: { priority, remark },
      create: { outlet_id, priority, remark }
    });
  }

  async batchSetPriorities(items: Array<{ outlet_id: string; priority: number }>) {
    const results = [];
    for (const item of items) {
      const r = await this.setPriority(item.outlet_id, item.priority);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (results as any[]).push(r);
    }
    return results;
  }

  // ── 强制手动地区 ─────────────────────────────────
  async getForcedManualRegions() {
    return this.prisma.forced_manual_regions.findMany({ orderBy: { created_at: 'asc' } });
  }

  async addForcedManualRegion(province: string, city?: string, remark?: string, adminId?: string) {
    return this.prisma.forced_manual_regions.create({
      data: { province, city: city || null, remark, updated_by: adminId }
    });
  }

  async removeForcedManualRegion(id: string) {
    return this.prisma.forced_manual_regions.delete({ where: { id } });
  }

  // ── 可派单网点列表（带匹配信息）────────────────────
  async getAvailableOutlets(addressJson?: string, businessTypeCode?: string) {
    const cfg = await this.getConfig();
    const addr = addressJson ? JSON.parse(addressJson) : null;
    const province = addr?.province || '';
    const city = addr?.city || '';
    const district = addr?.district || '';

    // 查询启用网点，关联业务类型和优先级
    const outlets = await this.prisma.outlets.findMany({
      where: { status: 1 },
      include: {
        outlet_business_types: { include: { business_type: true } },
        priority_info: true,
      }
    });

    // 过滤：业务类型匹配
    let filtered = outlets;
    if (cfg.business_type_filter && businessTypeCode) {
      filtered = filtered.filter(o =>
        o.outlet_business_types.some(b => b.business_type.code === businessTypeCode)
      );
    }

    // 强制手动地区检查
    const forcedProvinces = await this.prisma.forced_manual_regions.findMany({ where: { city: null } });
    const forcedCities = await this.prisma.forced_manual_regions.findMany({ where: { city: { not: null } } });
    const isForcedManual = (() => {
      const matchedCity = forcedCities.find(r => r.province === province && r.city === city);
      if (matchedCity) return true;
      const matchedProv = forcedProvinces.find(r => provincesMatch(province, r.province));
      return !!matchedProv;
    })();

    // 匹配分数：city匹配=100, province匹配=50, 不匹配=0
    const scored = filtered.map(o => {
      let score = o.priority_info?.priority ?? 0;
      const service_area: Array<{ province: string; city?: string }> = JSON.parse(o.service_area || '[]');

      const cityMatch = service_area.some(s => s.city === city && (s.province === province || provincesMatch(province, s.province)));
      const provMatch = !cityMatch && service_area.some(s => provincesMatch(province, s.province));

      if (cityMatch) score += 100;
      else if (provMatch) score += 50;

      return { ...o, matchScore: score, isForcedManual };
    });

    return scored.sort((a, b) => b.matchScore - a.matchScore);
  }

  // ── 核心派单逻辑（改造自 autoAssignStore）──────────
  async smartAssign(addressJson: string | null, businessTypeCode: string, adminId?: string) {
    const cfg = await this.getConfig();
    const mode = cfg.mode || 'hybrid';

    // manual：完全人工派单，不进入任何自动逻辑
    if (mode === 'manual') return null;

    const addr = addressJson ? JSON.parse(addressJson) : null;
    const province = addr?.province || '';
    const city = addr?.city || '';

    // 强制手动区域拦截（仅 hybrid 模式生效；auto 模式强制自动派单，忽略地区拦截）
    if (mode === 'hybrid' && addr) {
      const forcedProvinces = await this.prisma.forced_manual_regions.findMany({ where: { city: null } });
      const forcedCities = await this.prisma.forced_manual_regions.findMany({ where: { city: { not: null } } });
      const isForced = forcedCities.some(r => r.province === province && r.city === city) ||
        forcedProvinces.some(r => provincesMatch(province, r.province));
      if (isForced) return null; // 返回 null 表示需要手动派单
    }

    // 自动派单总开关（仅 hybrid 模式生效；auto 模式强制开启）
    if (mode === 'hybrid' && !cfg.auto_assign) return null;

    const candidates = await this.getAvailableOutlets(addressJson ?? undefined, businessTypeCode);
    if (candidates.length === 0) return null;

    // 最高分网点
    const best = candidates[0];

    // 方案A:无精确城市网点时转人工派单
    // 如果最高分网点不是城市匹配(仅省份匹配或无匹配),则不自动派单
    if (!best.isForcedManual && best.matchScore < 50) {
      // matchScore < 50 表示连省份精确匹配都没有，只有优先级分或无匹配
      return null;
    }

    return { outlet_id: best.id, storeName: best.name, matchScore: best.matchScore };
  }
}
