import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SealService } from './seal.service';
import { ProductAdminJwtAuthGuard as AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('刻章产品')
@Controller('seals')
export class SealController {
  constructor(private readonly sealService: SealService) {}

  // ==================== 用户端 ====================

  @Get('categories')
  @ApiOperation({ summary: '获取印章分类列表（全部分类，管理后台用）' })
  async getCategories() {
    return this.sealService.getCategories();
  }

  @Get('categories/:id')
  @ApiOperation({ summary: '获取分类下的印章和套餐' })
  async getCategoryProducts(
    @Param('id') id: string,
    @Query('region') region: string,
  ) {
    return this.sealService.getCategoryProducts(id, region);
  }

  @Get()
  @ApiOperation({ summary: '获取印章列表' })
  async getSeals(
    @Query('category_id') category_id?: string,
    @Query('region') region?: string,
  ) {
    return this.sealService.getSeals(category_id, region);
  }

  @Get('packages')
  @ApiOperation({ summary: '获取印章套餐列表' })
  async getPackages(@Query('region') region?: string) {
    return this.sealService.getPackages(region);
  }

  @Get('scenes')
  @ApiOperation({ summary: '获取业务场景列表' })
  async getScenes() {
    return this.sealService.getScenes();
  }

  @Get('scenes/:id')
  @ApiOperation({ summary: '获取场景下的印章和套餐' })
  async getSceneProducts(
    @Param('id') id: string,
    @Query('region') region: string,
  ) {
    return this.sealService.getSceneProducts(id, region);
  }

  // ==================== 管理端：场景（SealScene）管理 ====================

  @Get('admin/scenes')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：场景列表（含印章/套餐数量）' })
  async adminGetScenes() {
    return this.sealService.adminGetScenes();
  }

  @Get('admin/scenes/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：场景详情（印章+套餐）' })
  async adminGetScene(@Param('id') id: string) {
    return this.sealService.adminGetScene(id);
  }

  @Post('admin/scenes')
  @Log("印章", "印章场景", "admin/scenes")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：创建场景' })
  async adminCreateScene(@Body() dto: any) {
    return this.sealService.adminCreateScene(dto);
  }

  @Put('admin/scenes/:id')
  @Log("印章", "印章场景", "admin/scenes/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：更新场景' })
  async adminUpdateScene(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdateScene(id, dto);
  }

  @Delete('admin/scenes/:id')
  @Log("印章", "印章场景", "admin/scenes/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：删除场景' })
  async adminDeleteScene(@Param('id') id: string) {
    return this.sealService.adminDeleteScene(id);
  }

  @Put('admin/scenes/:id/seals')
  @Log("印章", "印章场景", "admin/scenes/:id/seals")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：设置场景印章（整体替换）' })
  async adminSetSceneSeals(@Param('id') id: string, @Body() dto: { seal_ids?: string[]; sealIds?: string[] }) {
    return this.sealService.adminSetSceneSeals(id, dto.seal_ids ?? dto.sealIds ?? []);
  }

  @Put('admin/scenes/:id/packages')
  @Log("印章", "印章场景", "admin/scenes/:id/packages")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：设置场景套餐（整体替换）' })
  async adminSetScenePackages(@Param('id') id: string, @Body() dto: { packages: any[] }) {
    return this.sealService.adminSetScenePackages(id, dto.packages || []);
  }

  // ==================== 管理端 ====================

  @Post('categories')
  @Log("印章", "分类", "categories")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建印章分类' })
  async createCategory(@Body() dto: any) {
    return this.sealService.adminCreateCategory(dto);
  }

  @Put('categories/:id')
  @Log("印章", "分类", "categories/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新印章分类' })
  async updateCategory(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Log("印章", "分类", "categories/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除印章分类' })
  async deleteCategory(@Param('id') id: string) {
    return this.sealService.adminDeleteCategory(id);
  }

  @Post()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建印章' })
  async createSeal(@Body() dto: any) {
    return this.sealService.adminCreateSeal(dto);
  }

  // ==================== 刻章备案查询管理 ====================

  @Get('admin/record-queries')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：刻章备案查询省份列表' })
  async adminGetRecordQueries() {
    return this.sealService.adminGetRecordQueries();
  }

  @Post('admin/record-queries')
  @Log("印章", "备案查询", "admin/record-queries")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：新增备案查询省份' })
  async adminCreateRecordQuery(@Body() dto: any) {
    return this.sealService.adminCreateRecordQuery(dto);
  }

  @Put('admin/record-queries/:id')
  @Log("印章", "备案查询", "admin/record-queries/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：更新备案查询省份' })
  async adminUpdateRecordQuery(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdateRecordQuery(id, dto);
  }

  @Delete('admin/record-queries/:id')
  @Log("印章", "备案查询", "admin/record-queries/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：删除备案查询省份' })
  async adminDeleteRecordQuery(@Param('id') id: string) {
    return this.sealService.adminDeleteRecordQuery(id);
  }

  @Put(':id')
  @Log("印章", "更新印章", ":id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新印章' })
  async updateSeal(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdateSeal(id, dto);
  }

  @Delete(':id')
  @Log("印章", "删除印章", ":id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除印章' })
  async deleteSeal(@Param('id') id: string) {
    return this.sealService.adminDeleteSeal(id);
  }

  @Post('packages')
  @Log("印章", "套餐", "packages")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建套餐' })
  async createPackage(@Body() dto: any) {
    return this.sealService.adminCreatePackage(dto);
  }

  @Put('packages/:id')
  @Log("印章", "套餐", "packages/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新套餐' })
  async updatePackage(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdatePackage(id, dto);
  }

  @Delete('packages/:id')
  @Log("印章", "套餐", "packages/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除套餐' })
  async deletePackage(@Param('id') id: string) {
    return this.sealService.adminDeletePackage(id);
  }
}
