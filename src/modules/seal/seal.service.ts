// @ts-nocheck
import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SealService {
  constructor(private prisma: PrismaService) {}

  // ==================== 用户端 ====================

  /** 获取印章分类列表（小程序用户端 + 管理后台：返回 seal_categories 全部分类） */
  async getCategories() {
    return this.prisma.seal_categories.findMany({
      where: { status: 1 },
      orderBy: { sort: 'asc' },
    });
  }

  /** 获取某个分类下的印章和套餐（用户端弹窗用） */
  /** 获取印章分类下的印章（小程序用户端） */
  async getCategoryProducts(category_id: string, region?: string) {
    const category = await this.prisma.seal_categories.findUnique({ where: { id: category_id } });
    if (!category) throw new NotFoundException('分类不存在');

    const seals = await this.prisma.seals.findMany({
      where: { category_id, status: 1 },
      include: { seal_categories: true },
      orderBy: { sort: 'asc' },
    });

    return {
      category,
      seals: seals.map((s) => ({ ...s, displayPrice: this.calcDisplayPrice(s, region || '') })),
    };
  }

  /** 获取印章列表（按分类/场景） */
  async getSeals(category_id?: string, region?: string) {
    const where: any = { status: 1 };
    if (category_id) {
      // 按场景关联表筛选（SealSceneSeal）
      const sceneSealIds = await this.prisma.seal_scene_seals.findMany({
        where: { scene_id: category_id },
        select: { seal_id: true },
      });
      if (sceneSealIds.length > 0) {
        where.id = { in: sceneSealIds.map((s) => s.seal_id) };
      } else {
        // 场景下无关联印章（如钢印章场景只有套餐），返回空
        where.id = { in: [] };
      }
    }

    const seals = await this.prisma.seals.findMany({
      where,
      include: { seal_categories: true },
      orderBy: { sort: 'asc' },
    });
    return seals.map((s) => ({ ...s, displayPrice: this.calcDisplayPrice(s, region || '') }));
  }

  /** 获取印章套餐列表 */
  async getPackages(region?: string) {
    const packages = await this.prisma.seal_packages.findMany({
      where: { status: 1 },
      orderBy: { sort: 'asc' },
    });

    // 补充印章详情（含 displayPrice）
    return Promise.all(
      packages.map(async (pkg) => ({
        ...pkg,
        seals: await this.prisma.seals.findMany({
          where: { id: { in: pkg.seal_ids } },
          include: { seal_categories: true },
        }),
      })),
    ).then((pkgs) =>
      pkgs.map((pkg) => ({
        ...pkg,
        seals: pkg.seals.map((s) => ({ ...s, displayPrice: this.calcDisplayPrice(s, region || '') })),
      })),
    );
  }

  /** 获取业务场景列表（小程序用户端首页选择，只返回 sceneType=scene） */
  async getScenes(userFacing = true) {
    return this.prisma.seal_scenes.findMany({
      where: userFacing ? { status: 1, sceneType: 'scene' } : { sceneType: 'scene' },
      orderBy: { sort: 'asc' },
    });
  }

  /** 获取某个场景下的印章和套餐（用户端弹窗用） */
  /**
   * 根据 region_prices JSONB 计算展示价格
   * region 参数格式：城市名（如 "成都市"、"北京"）
   * region_prices 格式：{ "成都市": 180, "北京市": 200 }
   * 优先级：region_prices[region] > 默认 price
   */
  private calcDisplayPrice(seal: any, region: string) {
    if (!region) return Number(seal.price);
    const regionPrices = typeof seal.region_prices === 'object' && seal.region_prices !== null
      ? seal.region_prices
      : {};
    // 精确匹配城市名
    if (regionPrices[region] !== undefined) return Number(regionPrices[region]);
    // 回退到默认 price
    return Number(seal.price);
  }

  async getSceneProducts(scene_id: string, region?: string) {
    // 优先查 seal_scenes（业务场景）
    let scene = await this.prisma.seal_scenes.findUnique({ where: { id: scene_id } });
    if (!scene) {
      // 尝试查 seal_categories（印章分类，含电子印章子分类）
      const category = await this.prisma.seal_categories.findUnique({ where: { id: scene_id } });
      if (!category) throw new NotFoundException('分类不存在');
      // 直接按 category_id 查印章
      const seals = await this.prisma.seals.findMany({
        where: { category_id: category.id, status: 1 },
        include: { seal_categories: true },
        orderBy: { sort: 'asc' },
      });
      return {
        scene: category,
        seals: seals.map((s) => ({ ...s, displayPrice: this.calcDisplayPrice(s, region || '') })),
        packages: [],
      };
    }

    // 获取该场景关联的印章（按 sort 排序）
    const sceneSeals = await this.prisma.seal_scene_seals.findMany({
      where: { scene_id },
      orderBy: { sort: 'asc' },
      include: { seal: { include: { seal_categories: true } } },
    });

    // 获取该场景关联的套餐（按 sort 排序）
    const scenePackages = await this.prisma.seal_scene_packages.findMany({
      where: { scene_id },
      orderBy: { sort: 'asc' },
      include: {
        package: true,
      },
    });

    // 套餐补全印章详情
    const packages = await Promise.all(
      scenePackages.map(async (sp) => {
        const seals = await this.prisma.seals.findMany({
          where: { id: { in: sp.package.seal_ids } },
          include: { seal_categories: true },
        });
        // 显示排序优先用关联表 sp.sort；未设置时回退到套餐自身 package.sort
        return {
          ...sp.package,
          seals: seals.map((s) => ({ ...s, displayPrice: this.calcDisplayPrice(s, region || '') })),
          sort: sp.sort || sp.package.sort,
        };
      }),
    );

    return {
      scene,
      // 显示排序优先用关联表 sf.sort；未设置（默认 0）时回退到印章自身 seal.sort，使管理端排序字段生效
      seals: sceneSeals.map((sf) => ({
        ...sf.seal,
        seal_categories: sf.seal.seal_categories,
        sort: sf.sort || sf.seal.sort,
        displayPrice: this.calcDisplayPrice(sf.seal, region || ''),
      })),
      packages,
    };
  }

  // ==================== 管理端 ====================

  /** 管理端：分类 CRUD（已统一为 SealScene） */
  async adminCreateCategory(dto: any) {
    return this.prisma.seal_scenes.create({
      data: { ...dto, sceneType: dto.sceneType || 'scene' },
    });
  }

  async adminUpdateCategory(id: string, dto: any) {
    return this.prisma.seal_scenes.update({ where: { id }, data: dto });
  }

  async adminDeleteCategory(id: string) {
    // 管理端删除场景：自动清除关联
    await this.prisma.seal_scene_seals.deleteMany({ where: { scene_id: id } });
    await this.prisma.seal_scene_packages.deleteMany({ where: { scene_id: id } });
    return this.prisma.seal_scenes.delete({ where: { id } });
  }

  /** 管理端：印章 CRUD */
  async adminCreateSeal(dto: any) {
    // categoryId = 场景 id（建立 SealSceneSeal 关联）；sealCategoryId = 旧 SealCategory（个人子分类，写回 seal.category_id）
    const { categoryId, sealCategoryId, ...rest } = dto;
    const seal = await this.prisma.seals.create({
      data: { ...rest, category_id: sealCategoryId ?? null },
    });
    if (category_id) {
      await this.prisma.seal_scene_seals.create({
        data: { scene_id: category_id, seal_id: seal.id, sort: 0 },
      });
    }
    return seal;
  }

  async adminUpdateSeal(id: string, dto: any) {
    // DTO 发 categoryId（camelCase），DB 用 category_id（snake_case）
    const { categoryId, sealCategoryId, ...rest } = dto;
    const category_id = categoryId; // rename for consistency
    const updateData: any = { ...rest };
    // 个人印章子分类：写回/清除 seal.category_id（空串统一为 null，避免无效外键）
    if (sealCategoryId !== undefined) updateData.category_id = sealCategoryId || null;
    const seal = await this.prisma.seals.update({ where: { id }, data: updateData });
    if (category_id !== undefined) {
      // 重新建立该印章的场景关联
      await this.prisma.seal_scene_seals.deleteMany({ where: { seal_id: id } });
      if (category_id) {
        await this.prisma.seal_scene_seals.create({
          data: { scene_id: category_id, seal_id: id, sort: 0 },
        });
      }
    }
    return seal;
  }

  async adminDeleteSeal(id: string) {
    await this.prisma.seal_scene_seals.deleteMany({ where: { seal_id: id } });
    return this.prisma.seals.delete({ where: { id } });
  }

  /** 刻章备案查询场景：按 route 动态解析（不再写死 UUID），找不到时回退常量 */
  private readonly RECORD_QUERY_SCENE_ID_FALLBACK = '9837519a-9dbf-4e52-b19e-60eea192eef6';
  private async getRecordQuerySceneId(): Promise<string> {
    const scene = await this.prisma.seal_scenes.findFirst({
      where: { route: { contains: 'type=query' } },
    });
    return scene?.id ?? this.RECORD_QUERY_SCENE_ID_FALLBACK;
  }

  /** 管理端：刻章备案查询 - 列表（所有省份） */
  async adminGetRecordQueries() {
    const scene_id = await this.getRecordQuerySceneId();
    const sceneSeals = await this.prisma.seal_scene_seals.findMany({
      where: { scene_id },
      orderBy: { sort: 'asc' },
      include: { seal: true },
    });
    return sceneSeals.map((sf) => ({
      ...sf.seal,
      sort: sf.sort,
    }));
  }

  /** 管理端：刻章备案查询 - 新增省份 */
  async adminCreateRecordQuery(dto: { name: string; description: string; sort?: number }) {
    // 1. 创建印章记录
    const seal = await this.prisma.seals.create({
      data: {
        name: dto.name,
        description: dto.description || '',
        price: 0,
        status: 1,
        category_id: null,
      },
    });
    // 2. 关联到备案查询场景
    const scene_id = await this.getRecordQuerySceneId();
    await this.prisma.seal_scene_seals.create({
      data: {
        scene_id,
        seal_id: seal.id,
        sort: dto.sort ?? 0,
      },
    });
    return seal;
  }

  /** 管理端：刻章备案查询 - 更新省份 */
  async adminUpdateRecordQuery(id: string, dto: { name?: string; description?: string; sort?: number }) {
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;

    const seal = await this.prisma.seals.update({ where: { id }, data: updateData });

    if (dto.sort !== undefined) {
      const scene_id = await this.getRecordQuerySceneId();
      await this.prisma.seal_scene_seals.updateMany({
        where: { seal_id: id, scene_id },
        data: { sort: dto.sort },
      });
    }

    return seal;
  }

  /** 管理端：刻章备案查询 - 删除省份 */
  async adminDeleteRecordQuery(id: string) {
    const scene_id = await this.getRecordQuerySceneId();
    await this.prisma.seal_scene_seals.deleteMany({ where: { seal_id: id, scene_id } });
    return this.prisma.seals.delete({ where: { id } });
  }

  /** 管理端：套餐 CRUD */
  async adminCreatePackage(dto: any) {
    return this.prisma.seal_packages.create({ data: dto });
  }

  async adminUpdatePackage(id: string, dto: any) {
    return this.prisma.seal_packages.update({ where: { id }, data: dto });
  }

  async adminDeletePackage(id: string) {
    return this.prisma.seal_packages.delete({ where: { id } });
  }

  // ==================== 管理端：场景（SealScene）管理 ====================

  /** 管理端：场景列表（含印章/套餐数量） */
  async adminGetScenes() {
    return this.prisma.seal_scenes.findMany({
      orderBy: { sort: 'asc' },
      include: {
        _count: {
          select: { seal_scene_seals: true, seal_scene_packages: true },
        },
      },
    });
  }

  /** 管理端：场景详情（印章 + 套餐） */
  async adminGetScene(id: string) {
    const scene = await this.prisma.seal_scenes.findUnique({ where: { id } });
    if (!scene) throw new NotFoundException('场景不存在');
    const sceneSeals = await this.prisma.seal_scene_seals.findMany({
      where: { scene_id: id },
      orderBy: { sort: 'asc' },
      include: { seal: { include: { seal_categories: true } } },
    });
    const scenePackages = await this.prisma.seal_scene_packages.findMany({
      where: { scene_id: id },
      orderBy: { sort: 'asc' },
      include: { package: true },
    });
    // 套餐补全印章详情
    const packages = await Promise.all(
      scenePackages.map(async (sp) => {
        const seals = await this.prisma.seals.findMany({
          where: { id: { in: sp.package.seal_ids } },
          include: { seal_categories: true },
        });
        return {
          ...sp.package,
          seals: seals.map((s) => ({ ...s, displayPrice: this.calcDisplayPrice(s, '') })),
          sort: sp.sort || sp.package.sort,
        };
      }),
    );
    return {
      scene,
      seals: sceneSeals.map((sf) => ({
        ...sf.seal,
        seal_categories: sf.seal.seal_categories,
        sort: sf.sort || sf.seal.sort,
        displayPrice: this.calcDisplayPrice(sf.seal, ''),
      })),
      packages,
    };
  }

  /** 管理端：创建场景 */
  async adminCreateScene(dto: any) {
    return this.prisma.seal_scenes.create({
      data: { ...dto, sceneType: 'scene' },
    });
  }

  /** 管理端：更新场景 */
  async adminUpdateScene(id: string, dto: any) {
    return this.prisma.seal_scenes.update({ where: { id }, data: dto });
  }

  /** 管理端：删除场景（级联清除关联） */
  async adminDeleteScene(id: string) {
    await this.prisma.seal_scene_seals.deleteMany({ where: { scene_id: id } });
    const oldJoins = await this.prisma.seal_scene_packages.findMany({
      where: { scene_id: id },
      select: { package_id: true },
    });
    await this.prisma.seal_scene_packages.deleteMany({ where: { scene_id: id } });
    const oldIds = oldJoins.map((j) => j.package_id);
    if (oldIds.length > 0) {
      // 仅删除未被其他场景引用的套餐，避免误删共享套餐
      const stillRef = await this.prisma.seal_scene_packages.findMany({
        where: { package_id: { in: oldIds } },
        select: { package_id: true },
      });
      const safeDelete = oldIds.filter((pid) => !stillRef.some((r) => r.package_id === pid));
      if (safeDelete.length > 0) {
        await this.prisma.seal_packages.deleteMany({ where: { id: { in: safeDelete } } });
      }
    }
    return this.prisma.seal_scenes.delete({ where: { id } });
  }

  /** 管理端：设置场景印章（整体替换） */
  async adminSetSceneSeals(scene_id: string, seal_ids: string[]) {
    await this.prisma.seal_scene_seals.deleteMany({ where: { scene_id } });
    if (seal_ids.length > 0) {
      await this.prisma.seal_scene_seals.createMany({
        data: seal_ids.map((seal_id, i) => ({ scene_id, seal_id, sort: i + 1 })),
      });
    }
    return { count: seal_ids.length };
  }

  /** 管理端：设置场景套餐（整体替换）
   *  packages: [{ id?, name, price, seal_ids?, badge? }]
   *  - 带 id 且非新建：仅建立关联（复用已有套餐）
   *  - 不带 id / isNew：新建套餐并关联
   */
  async adminSetScenePackages(scene_id: string, packages: any[]) {
    const oldJoins = await this.prisma.seal_scene_packages.findMany({
      where: { scene_id },
      select: { package_id: true },
    });
    const oldIds = oldJoins.map((j) => j.package_id);
    await this.prisma.seal_scene_packages.deleteMany({ where: { scene_id } });
    // 删除仅本场景使用的旧套餐
    if (oldIds.length > 0) {
      const stillRef = await this.prisma.seal_scene_packages.findMany({
        where: { package_id: { in: oldIds } },
        select: { package_id: true },
      });
      const safeDelete = oldIds.filter((pid) => !stillRef.some((r) => r.package_id === pid));
      if (safeDelete.length > 0) {
        await this.prisma.seal_packages.deleteMany({ where: { id: { in: safeDelete } } });
      }
    }
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      if (pkg.id && !pkg.isNew) {
        await this.prisma.seal_scene_packages.create({
          data: { scene_id, package_id: pkg.id, sort: i + 1 },
        });
      } else {
        const pkgId = uuidv4();
        await this.prisma.seal_packages.create({
          data: {
            id: pkgId,
            name: pkg.name,
            price: pkg.price,
            seal_ids: pkg.seal_ids || [],
            badge: pkg.badge || null,
            sort: i + 1,
          },
        });
        await this.prisma.seal_scene_packages.create({
          data: { scene_id, package_id: pkgId, sort: i + 1 },
        });
      }
    }
    return { count: packages.length };
  }
}
