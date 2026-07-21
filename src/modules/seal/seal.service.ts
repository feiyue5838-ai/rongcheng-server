import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SealService {
  constructor(private prisma: PrismaService) {}

  // ==================== 用户端 ====================

  /** 获取印章分类列表（管理后台用：返回全部分类含辅助场景） */
  async getCategories() {
    return this.prisma.sealScene.findMany({
      where: { status: 1 },
      orderBy: { sort: 'asc' },
    });
  }

  /** 获取某个分类下的印章和套餐（用户端弹窗用） */
  async getCategoryProducts(categoryId: string) {
    return this.getSceneProducts(categoryId);
  }

  /** 获取印章列表（按分类/场景） */
  async getSeals(categoryId?: string) {
    const where: any = { status: 1 };
    if (categoryId) {
      // 按场景关联表筛选（SealSceneSeal）
      const sceneSealIds = await this.prisma.sealSceneSeal.findMany({
        where: { sceneId: categoryId },
        select: { sealId: true },
      });
      if (sceneSealIds.length > 0) {
        where.id = { in: sceneSealIds.map((s) => s.sealId) };
      } else {
        // 场景下无关联印章（如钢印章场景只有套餐），返回空
        where.id = { in: [] };
      }
    }

    return this.prisma.seal.findMany({
      where,
      include: { category: true },
      orderBy: { sort: 'asc' },
    });
  }

  /** 获取印章套餐列表 */
  async getPackages() {
    const packages = await this.prisma.sealPackage.findMany({
      where: { status: 1 },
      orderBy: { sort: 'asc' },
    });

    // 补充印章详情
    return Promise.all(
      packages.map(async (pkg) => ({
        ...pkg,
        seals: await this.prisma.seal.findMany({
          where: { id: { in: pkg.sealIds } },
        }),
      })),
    );
  }

  /** 获取业务场景列表（小程序用户端首页选择，只返回 sceneType=scene） */
  async getScenes(userFacing = true) {
    return this.prisma.sealScene.findMany({
      where: userFacing ? { status: 1, sceneType: 'scene' } : { sceneType: 'scene' },
      orderBy: { sort: 'asc' },
    });
  }

  /** 获取某个场景下的印章和套餐（用户端弹窗用） */
  async getSceneProducts(sceneId: string) {
    const scene = await this.prisma.sealScene.findUnique({ where: { id: sceneId } });
    if (!scene) throw new NotFoundException('场景不存在');

    // 获取该场景关联的印章（按 sort 排序）
    const sceneSeals = await this.prisma.sealSceneSeal.findMany({
      where: { sceneId },
      orderBy: { sort: 'asc' },
      include: { seal: { include: { category: true } } },
    });

    // 获取该场景关联的套餐（按 sort 排序）
    const scenePackages = await this.prisma.sealScenePackage.findMany({
      where: { sceneId },
      orderBy: { sort: 'asc' },
      include: {
        package: true,
      },
    });

    // 套餐补全印章详情
    const packages = await Promise.all(
      scenePackages.map(async (sp) => {
        const seals = await this.prisma.seal.findMany({
          where: { id: { in: sp.package.sealIds } },
          include: { category: true },
        });
        // 显示排序优先用关联表 sp.sort；未设置时回退到套餐自身 package.sort
        return { ...sp.package, seals, sort: sp.sort || sp.package.sort };
      }),
    );

    return {
      scene,
      // 显示排序优先用关联表 sf.sort；未设置（默认 0）时回退到印章自身 seal.sort，使管理端排序字段生效
      seals: sceneSeals.map((sf) => ({ ...sf.seal, category: sf.seal.category, sort: sf.sort || sf.seal.sort })),
      packages,
    };
  }

  // ==================== 管理端 ====================

  /** 管理端：分类 CRUD（已统一为 SealScene） */
  async adminCreateCategory(dto: any) {
    return this.prisma.sealScene.create({
      data: { ...dto, sceneType: dto.sceneType || 'scene' },
    });
  }

  async adminUpdateCategory(id: string, dto: any) {
    return this.prisma.sealScene.update({ where: { id }, data: dto });
  }

  async adminDeleteCategory(id: string) {
    // 管理端删除场景：自动清除关联
    await this.prisma.sealSceneSeal.deleteMany({ where: { sceneId: id } });
    await this.prisma.sealScenePackage.deleteMany({ where: { sceneId: id } });
    return this.prisma.sealScene.delete({ where: { id } });
  }

  /** 管理端：印章 CRUD */
  async adminCreateSeal(dto: any) {
    // categoryId = 场景 id（建立 SealSceneSeal 关联）；sealCategoryId = 旧 SealCategory（个人子分类，写回 seal.categoryId）
    const { categoryId, sealCategoryId, ...rest } = dto;
    const seal = await this.prisma.seal.create({
      data: { ...rest, categoryId: sealCategoryId ?? null },
    });
    if (categoryId) {
      await this.prisma.sealSceneSeal.create({
        data: { sceneId: categoryId, sealId: seal.id, sort: 0 },
      });
    }
    return seal;
  }

  async adminUpdateSeal(id: string, dto: any) {
    const { categoryId, sealCategoryId, ...rest } = dto;
    const updateData: any = { ...rest };
    // 个人印章子分类：写回/清除 seal.categoryId（空串统一为 null，避免无效外键）
    if (sealCategoryId !== undefined) updateData.categoryId = sealCategoryId || null;
    const seal = await this.prisma.seal.update({ where: { id }, data: updateData });
    if (categoryId !== undefined) {
      // 重新建立该印章的场景关联
      await this.prisma.sealSceneSeal.deleteMany({ where: { sealId: id } });
      if (categoryId) {
        await this.prisma.sealSceneSeal.create({
          data: { sceneId: categoryId, sealId: id, sort: 0 },
        });
      }
    }
    return seal;
  }

  async adminDeleteSeal(id: string) {
    await this.prisma.sealSceneSeal.deleteMany({ where: { sealId: id } });
    return this.prisma.seal.delete({ where: { id } });
  }

  /** 刻章备案查询场景：按 route 动态解析（不再写死 UUID），找不到时回退常量 */
  private readonly RECORD_QUERY_SCENE_ID_FALLBACK = '9837519a-9dbf-4e52-b19e-60eea192eef6';
  private async getRecordQuerySceneId(): Promise<string> {
    const scene = await this.prisma.sealScene.findFirst({
      where: { route: { contains: 'type=query' } },
    });
    return scene?.id ?? this.RECORD_QUERY_SCENE_ID_FALLBACK;
  }

  /** 管理端：刻章备案查询 - 列表（所有省份） */
  async adminGetRecordQueries() {
    const sceneId = await this.getRecordQuerySceneId();
    const sceneSeals = await this.prisma.sealSceneSeal.findMany({
      where: { sceneId },
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
    const seal = await this.prisma.seal.create({
      data: {
        name: dto.name,
        description: dto.description || '',
        price: 0,
        status: 1,
        categoryId: null,
      },
    });
    // 2. 关联到备案查询场景
    const sceneId = await this.getRecordQuerySceneId();
    await this.prisma.sealSceneSeal.create({
      data: {
        sceneId,
        sealId: seal.id,
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

    const seal = await this.prisma.seal.update({ where: { id }, data: updateData });

    if (dto.sort !== undefined) {
      const sceneId = await this.getRecordQuerySceneId();
      await this.prisma.sealSceneSeal.updateMany({
        where: { sealId: id, sceneId },
        data: { sort: dto.sort },
      });
    }

    return seal;
  }

  /** 管理端：刻章备案查询 - 删除省份 */
  async adminDeleteRecordQuery(id: string) {
    const sceneId = await this.getRecordQuerySceneId();
    await this.prisma.sealSceneSeal.deleteMany({ where: { sealId: id, sceneId } });
    return this.prisma.seal.delete({ where: { id } });
  }

  /** 管理端：套餐 CRUD */
  async adminCreatePackage(dto: any) {
    return this.prisma.sealPackage.create({ data: dto });
  }

  async adminUpdatePackage(id: string, dto: any) {
    return this.prisma.sealPackage.update({ where: { id }, data: dto });
  }

  async adminDeletePackage(id: string) {
    return this.prisma.sealPackage.delete({ where: { id } });
  }

  // ==================== 管理端：场景（SealScene）管理 ====================

  /** 管理端：场景列表（含印章/套餐数量） */
  async adminGetScenes() {
    return this.prisma.sealScene.findMany({
      orderBy: { sort: 'asc' },
      include: {
        _count: {
          select: { sealSceneSeals: true, sealScenePackages: true },
        },
      },
    });
  }

  /** 管理端：场景详情（印章 + 套餐） */
  async adminGetScene(id: string) {
    const scene = await this.prisma.sealScene.findUnique({ where: { id } });
    if (!scene) throw new NotFoundException('场景不存在');
    const seals = await this.prisma.sealSceneSeal.findMany({
      where: { sceneId: id },
      orderBy: { sort: 'asc' },
      include: { seal: true },
    });
    const packages = await this.prisma.sealScenePackage.findMany({
      where: { sceneId: id },
      orderBy: { sort: 'asc' },
      include: { package: true },
    });
    return {
      scene,
      seals: seals.map((s) => s.seal),
      packages: packages.map((p) => p.package),
    };
  }

  /** 管理端：创建场景 */
  async adminCreateScene(dto: any) {
    return this.prisma.sealScene.create({
      data: { ...dto, sceneType: 'scene' },
    });
  }

  /** 管理端：更新场景 */
  async adminUpdateScene(id: string, dto: any) {
    return this.prisma.sealScene.update({ where: { id }, data: dto });
  }

  /** 管理端：删除场景（级联清除关联） */
  async adminDeleteScene(id: string) {
    await this.prisma.sealSceneSeal.deleteMany({ where: { sceneId: id } });
    const oldJoins = await this.prisma.sealScenePackage.findMany({
      where: { sceneId: id },
      select: { packageId: true },
    });
    await this.prisma.sealScenePackage.deleteMany({ where: { sceneId: id } });
    const oldIds = oldJoins.map((j) => j.packageId);
    if (oldIds.length > 0) {
      // 仅删除未被其他场景引用的套餐，避免误删共享套餐
      const stillRef = await this.prisma.sealScenePackage.findMany({
        where: { packageId: { in: oldIds } },
        select: { packageId: true },
      });
      const safeDelete = oldIds.filter((pid) => !stillRef.some((r) => r.packageId === pid));
      if (safeDelete.length > 0) {
        await this.prisma.sealPackage.deleteMany({ where: { id: { in: safeDelete } } });
      }
    }
    return this.prisma.sealScene.delete({ where: { id } });
  }

  /** 管理端：设置场景印章（整体替换） */
  async adminSetSceneSeals(sceneId: string, sealIds: string[]) {
    await this.prisma.sealSceneSeal.deleteMany({ where: { sceneId } });
    if (sealIds.length > 0) {
      await this.prisma.sealSceneSeal.createMany({
        data: sealIds.map((sealId, i) => ({ sceneId, sealId, sort: i + 1 })),
      });
    }
    return { count: sealIds.length };
  }

  /** 管理端：设置场景套餐（整体替换）
   *  packages: [{ id?, name, price, sealIds?, badge? }]
   *  - 带 id 且非新建：仅建立关联（复用已有套餐）
   *  - 不带 id / isNew：新建套餐并关联
   */
  async adminSetScenePackages(sceneId: string, packages: any[]) {
    const oldJoins = await this.prisma.sealScenePackage.findMany({
      where: { sceneId },
      select: { packageId: true },
    });
    const oldIds = oldJoins.map((j) => j.packageId);
    await this.prisma.sealScenePackage.deleteMany({ where: { sceneId } });
    // 删除仅本场景使用的旧套餐
    if (oldIds.length > 0) {
      const stillRef = await this.prisma.sealScenePackage.findMany({
        where: { packageId: { in: oldIds } },
        select: { packageId: true },
      });
      const safeDelete = oldIds.filter((pid) => !stillRef.some((r) => r.packageId === pid));
      if (safeDelete.length > 0) {
        await this.prisma.sealPackage.deleteMany({ where: { id: { in: safeDelete } } });
      }
    }
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      if (pkg.id && !pkg.isNew) {
        await this.prisma.sealScenePackage.create({
          data: { sceneId, packageId: pkg.id, sort: i + 1 },
        });
      } else {
        const pkgId = uuidv4();
        await this.prisma.sealPackage.create({
          data: {
            id: pkgId,
            name: pkg.name,
            price: pkg.price,
            sealIds: pkg.sealIds || [],
            badge: pkg.badge || null,
            sort: i + 1,
          },
        });
        await this.prisma.sealScenePackage.create({
          data: { sceneId, packageId: pkgId, sort: i + 1 },
        });
      }
    }
    return { count: packages.length };
  }
}
