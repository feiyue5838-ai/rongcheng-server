import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SealService } from './seal.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('刻章产品')
@Controller('seals')
export class SealController {
  constructor(private readonly sealService: SealService) {}

  // ==================== 用户端 ====================

  @Get('categories')
  @ApiOperation({ summary: '获取印章分类列表（8个业务场景）' })
  async getCategories() {
    return this.sealService.getCategories(true);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: '获取分类下的印章和套餐' })
  async getCategoryProducts(@Param('id') id: string) {
    return this.sealService.getCategoryProducts(id);
  }

  @Get()
  @ApiOperation({ summary: '获取印章列表' })
  async getSeals(@Query('categoryId') categoryId?: string) {
    return this.sealService.getSeals(categoryId);
  }

  @Get('packages')
  @ApiOperation({ summary: '获取印章套餐列表' })
  async getPackages() {
    return this.sealService.getPackages();
  }

  @Get('scenes')
  @ApiOperation({ summary: '获取业务场景列表' })
  async getScenes() {
    return this.sealService.getScenes();
  }

  @Get('scenes/:id')
  @ApiOperation({ summary: '获取场景下的印章和套餐' })
  async getSceneProducts(@Param('id') id: string) {
    return this.sealService.getSceneProducts(id);
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
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：创建场景' })
  async adminCreateScene(@Body() dto: any) {
    return this.sealService.adminCreateScene(dto);
  }

  @Put('admin/scenes/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：更新场景' })
  async adminUpdateScene(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdateScene(id, dto);
  }

  @Delete('admin/scenes/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：删除场景' })
  async adminDeleteScene(@Param('id') id: string) {
    return this.sealService.adminDeleteScene(id);
  }

  @Put('admin/scenes/:id/seals')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：设置场景印章（整体替换）' })
  async adminSetSceneSeals(@Param('id') id: string, @Body() dto: { sealIds: string[] }) {
    return this.sealService.adminSetSceneSeals(id, dto.sealIds || []);
  }

  @Put('admin/scenes/:id/packages')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：设置场景套餐（整体替换）' })
  async adminSetScenePackages(@Param('id') id: string, @Body() dto: { packages: any[] }) {
    return this.sealService.adminSetScenePackages(id, dto.packages || []);
  }

  // ==================== 管理端 ====================

  @Get('admin/categories')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：获取旧印章分类（SealCategory）' })
  async adminGetCategories() {
    return this.sealService.adminGetCategories();
  }

  @Get('admin')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：印章列表（按旧 categoryId 筛选）' })
  async adminGetSeals(@Query('categoryId') categoryId?: string) {
    return this.sealService.adminGetSeals(categoryId);
  }

  @Post('categories')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建印章分类' })
  async createCategory(@Body() dto: any) {
    return this.sealService.adminCreateCategory(dto);
  }

  @Put('categories/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新印章分类' })
  async updateCategory(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdateCategory(id, dto);
  }

  @Delete('categories/:id')
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
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：新增备案查询省份' })
  async adminCreateRecordQuery(@Body() dto: any) {
    return this.sealService.adminCreateRecordQuery(dto);
  }

  @Put('admin/record-queries/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：更新备案查询省份' })
  async adminUpdateRecordQuery(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdateRecordQuery(id, dto);
  }

  @Delete('admin/record-queries/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：删除备案查询省份' })
  async adminDeleteRecordQuery(@Param('id') id: string) {
    return this.sealService.adminDeleteRecordQuery(id);
  }

  @Put(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新印章' })
  async updateSeal(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdateSeal(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除印章' })
  async deleteSeal(@Param('id') id: string) {
    return this.sealService.adminDeleteSeal(id);
  }

  @Post('packages')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建套餐' })
  async createPackage(@Body() dto: any) {
    return this.sealService.adminCreatePackage(dto);
  }

  @Put('packages/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新套餐' })
  async updatePackage(@Param('id') id: string, @Body() dto: any) {
    return this.sealService.adminUpdatePackage(id, dto);
  }
}
