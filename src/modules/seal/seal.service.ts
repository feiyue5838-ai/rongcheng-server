import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SealService {
  constructor(private prisma: PrismaService) {}

  // ==================== 用户端 ====================

  /** 获取印章分类列表 */
  async getCategories(userFacing = true) {
    return this.prisma.sealScene.findMany({
      where: userFacing ? { status: 1, sceneType: 'scene' } : { sceneType: 'scene' },
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

  /** 获取业务场景列表（用户端首页选择） */
  async getScenes(userFacing = true) {
    return this.getCategories(userFacing);
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
        return { ...sp.package, seals };
      }),
    );

    return {
      scene,
      seals: sceneSeals.map((sf) => ({ ...sf.seal, category: sf.seal.category })),
      packages,
    };
  }

  // ==================== 管理端 ====================

  /** 管理端：印章列表（按旧 SealCategory.categoryId 筛选） */
  async adminGetSeals(categoryId?: string) {
    const where: any = { status: 1 };
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.seal.findMany({
      where,
      include: { category: true },
      orderBy: { sort: 'asc' },
    });
  }

  /** 管理端：获取旧印章分类（SealCategory，用于管理后台筛选 Tab） */
  async adminGetCategories() {
    return this.prisma.sealCategory.findMany({
      where: { status: 1 },
      orderBy: { sort: 'asc' },
    });
  }

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
    // categoryId 现在是场景 id，同时创建 SealSceneSeal 关联
    const { categoryId, ...rest } = dto;
    const seal = await this.prisma.seal.create({ data: rest });
    if (categoryId) {
      await this.prisma.sealSceneSeal.create({
        data: { sceneId: categoryId, sealId: seal.id, sort: 0 },
      });
    }
    return seal;
  }

  async adminUpdateSeal(id: string, dto: any) {
    const { categoryId, ...rest } = dto;
    const seal = await this.prisma.seal.update({ where: { id }, data: rest });
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

  /** 刻章备案查询场景 ID（常量） */
  private readonly RECORD_QUERY_SCENE_ID = '9837519a-9dbf-4e52-b19e-60eea192eef6';

  /** 管理端：刻章备案查询 - 列表（所有省份） */
  async adminGetRecordQueries() {
    const sceneSeals = await this.prisma.sealSceneSeal.findMany({
      where: { sceneId: this.RECORD_QUERY_SCENE_ID },
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
    await this.prisma.sealSceneSeal.create({
      data: {
        sceneId: this.RECORD_QUERY_SCENE_ID,
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
      await this.prisma.sealSceneSeal.updateMany({
        where: { sealId: id, sceneId: this.RECORD_QUERY_SCENE_ID },
        data: { sort: dto.sort },
      });
    }

    return seal;
  }

  /** 管理端：刻章备案查询 - 删除省份 */
  async adminDeleteRecordQuery(id: string) {
    await this.prisma.sealSceneSeal.deleteMany({ where: { sealId: id, sceneId: this.RECORD_QUERY_SCENE_ID } });
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
}
