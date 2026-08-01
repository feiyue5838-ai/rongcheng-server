import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NewspaperService } from './newspaper.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('登报')
@Controller('newspapers')
export class NewspaperController {
  constructor(private readonly newspaperService: NewspaperService) {}

  @Get('categories')
  @ApiOperation({ summary: '获取登报分类' })
  async getCategories(@Query('skipCache') skipCache?: string) {
    return this.newspaperService.getCategories(skipCache !== 'false');
  }

  @Post('categories')
  @Log("报纸", "分类", "categories")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建登报分类' })
  async createCategory(@Body() dto: any) {
    return this.newspaperService.adminCreateCategory(dto);
  }

  @Put('categories/:id')
  @Log("报纸", "分类", "categories/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新登报分类' })
  async updateCategory(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminUpdateCategory(id, dto);
  }

  @Delete('categories/:id')
  @Log("报纸", "分类", "categories/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除登报分类' })
  async deleteCategory(@Param('id') id: string) {
    return this.newspaperService.adminDeleteCategory(id);
  }

  @Get()
  @ApiOperation({ summary: '获取报纸列表（支持 region/province_code/city_code 精确匹配）' })
  async getNewspapers(
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('province_code') province_code?: string,
    @Query('city_code') city_code?: string,
    @Query('level') level?: string,
    @Query('category_id') category_id?: string,
    @Query('region') region?: string,
    @Query('pageSize') pageSize?: string,
    @Query('pageNum') pageNum?: string,
  ) {
    return this.newspaperService.getNewspapers({
      province, city, province_code, city_code, level, category_id, region, pageSize, pageNum
    });
  }

  @Get('all')
  @ApiOperation({ summary: '获取全部报纸（不分页，供管理后台统计使用）' })
  async getAllNewspapers() {
    return this.newspaperService.getAllNewspapers();
  }

  @Get('templates')
  @ApiOperation({ summary: '获取登报模板' })
  async getTemplates(
    @Query('newspaper_id') newspaper_id?: string,
    @Query('category_id') category_id?: string,
    @Query('businessType') businessType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('skipCache') skipCache?: string,
  ) {
    // 管理端默认 skipCache=true，避免缓存导致删除/编辑后列表不更新
    return this.newspaperService.getTemplates(
      newspaper_id,
      category_id,
      businessType,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
      skipCache !== 'false'
    );
  }

  @Get('price')
  @ApiOperation({ summary: '计算登报价格（含期数×份数）' })
  async calculatePrice(
    @Query('newspaper_id') newspaper_id: string,
    @Query('contentLength') contentLength: number,
    @Query('issueCount') issueCount?: number,
    @Query('copyCount') copyCount?: number,
  ) {
    return this.newspaperService.calculatePrice(newspaper_id, contentLength, issueCount, copyCount);
  }

  // 管理端
  @Post()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建报纸' })
  async create(@Body() dto: any) {
    return this.newspaperService.adminCreateNewspaper(dto);
  }

  @Put(':id')
  @Log("报纸", "更新报纸", ":id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新报纸' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminUpdateNewspaper(id, dto);
  }

  @Delete(':id')
  @Log("报纸", "删除报纸", ":id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除报纸' })
  async delete(@Param('id') id: string) {
    return this.newspaperService.adminDeleteNewspaper(id);
  }

  @Post('templates')
  @Log("报纸", "模板", "templates")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建模板' })
  async createTemplate(@Body() dto: any) {
    return this.newspaperService.adminCreateTemplate(dto);
  }

  @Put('templates/:id')
  @Log("报纸", "模板", "templates/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新模板' })
  async updateTemplate(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminUpdateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Log("报纸", "模板", "templates/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除模板' })
  async deleteTemplate(@Param('id') id: string) {
    return this.newspaperService.adminDeleteTemplate(id);
  }

  // ========== 个人证件 ==========

  @Get('personal-docs')
  @ApiOperation({ summary: '获取个人证件分类+证件列表' })
  async getPersonalDocs() {
    return this.newspaperService.getPersonalDocs();
  }

  // ========== 发票收据 ==========

  @Get('invoice-templates')
  @ApiOperation({ summary: '获取发票收据模板（按业务类型分组）' })
  async getInvoiceTemplates() {
    return this.newspaperService.getInvoiceTemplates();
  }

  // ========== 公告模板 ==========

  @Get('announcement-templates')
  @ApiOperation({ summary: '获取声明公告模板（按 templateType 分组，供小程序 announcement 页面 id=5）' })
  async getAnnouncementTemplates() {
    return this.newspaperService.getAnnouncementTemplates();
  }

  @Get('notice-templates')
  @ApiOperation({ summary: '获取公告声明模板（按 templateType 分组，供小程序 announcement 页面 id=6）' })
  async getNoticeTemplates() {
    return this.newspaperService.getNoticeTemplates();
  }

  // 管理端 - 分类 CRUD
  @Post('personal-docs/categories')
  @Log("报纸", "分类", "personal-docs/categories")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建个人证件大类' })
  async createPersonalDocCategory(@Body() dto: any) {
    return this.newspaperService.adminCreatePersonalDocCategory(dto);
  }

  @Put('personal-docs/categories/:id')
  @Log("报纸", "分类", "personal-docs/categories/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新个人证件大类' })
  async updatePersonalDocCategory(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminUpdatePersonalDocCategory(id, dto);
  }

  @Delete('personal-docs/categories/:id')
  @Log("报纸", "分类", "personal-docs/categories/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除个人证件大类' })
  async deletePersonalDocCategory(@Param('id') id: string) {
    return this.newspaperService.adminDeletePersonalDocCategory(id);
  }

  // 管理端 - 证件细项 CRUD
  @Post('personal-docs/items')
  @Log("报纸", "个人证件", "personal-docs/items")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建个人证件细项' })
  async createPersonalDocItem(@Body() dto: any) {
    return this.newspaperService.adminCreatePersonalDocItem(dto);
  }

  @Put('personal-docs/items/:id')
  @Log("报纸", "个人证件", "personal-docs/items/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新个人证件细项' })
  async updatePersonalDocItem(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminUpdatePersonalDocItem(id, dto);
  }

  @Delete('personal-docs/items/:id')
  @Log("报纸", "个人证件", "personal-docs/items/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除个人证件细项' })
  async deletePersonalDocItem(@Param('id') id: string) {
    return this.newspaperService.adminDeletePersonalDocItem(id);
  }

  // ========== 企业证件 ==========

  @Get('company-doc-templates')
  @ApiOperation({ summary: '获取企业证件模板（按 12 分类分组）' })
  async getCompanyDocTemplates() {
    return this.newspaperService.getCompanyDocTemplates();
  }

  // ========== 法院公告 ==========

  @Get('court-templates')
  @ApiOperation({ summary: '获取法院公告模板（按 9 分类分组）' })
  async getCourtTemplates() {
    return this.newspaperService.getCourtTemplates();
  }

  // ========== 政府送达 ==========

  @Get('government-templates')
  @ApiOperation({ summary: '获取政府送达模板（按 5 分类分组）' })
  async getGovernmentTemplates() {
    return this.newspaperService.getGovernmentTemplates();
  }

  // ========== 招标公告 ==========

  @Get('bidding-templates')
  @ApiOperation({ summary: '获取招标公告模板（按 3 分类分组）' })
  async getBiddingTemplates() {
    return this.newspaperService.getBiddingTemplates();
  }

  // ========== 登报道歉 ==========

  @Get('apology-templates')
  @ApiOperation({ summary: '获取登报道歉模板（按 4 子分类分组）' })
  async getApologyTemplates() {
    return this.newspaperService.getApologyTemplates()
  }

  // ========== 债权债务 ==========

  @Get('creditor-templates')
  @ApiOperation({ summary: '获取债权债务模板（按 4 分类分组）' })
  async getCreditorTemplates() {
    return this.newspaperService.getCreditorTemplates();
  }

  // ========== 环评公示 ==========

  @Get('env-templates')
  @ApiOperation({ summary: '获取环评公示模板（按 5 分类分组）' })
  async getEnvTemplates() {
    return this.newspaperService.getEnvTemplates();
  }

  // ========== 表扬信 ==========

  @Get('praise-templates')
  @ApiOperation({ summary: '获取表扬信模板（按 4 分类分组，供小程序 praise 页面）' })
  async getPraiseTemplates() {
    return this.newspaperService.getPraiseTemplates();
  }

  // ========== 劳动纠纷 ==========

  @Get('labor-templates')
  @ApiOperation({ summary: '获取劳动纠纷模板（按 4 分类分组，供小程序 labor-dispute 页面）' })
  async getLaborTemplates() {
    return this.newspaperService.getLaborTemplates();
  }

  // ========== 拍卖公告 ==========

  @Get('auction-templates')
  @ApiOperation({ summary: '获取拍卖公告模板（按 4 分类分组）' })
  async getAuctionTemplates() {
    return this.newspaperService.getAuctionTemplates();
  }

  // ========== 公示公告 ==========

  @Get('publicity-templates')
  @ApiOperation({ summary: '获取公示公告模板（按 5 分类分组）' })
  async getPublicityTemplates() {
    return this.newspaperService.getPublicityTemplates();
  }

  // ========== 模板元数据（供管理前端下拉）==========

  @Get('template-meta')
  @ApiOperation({ summary: '获取模板分组元数据（businessType + subType 下拉用）' })
  async getTemplateMeta() {
    return this.newspaperService.getTemplateMeta();
  }

  // ========== 版面管理 ==========

  @Get(':id/sections')
  @ApiOperation({ summary: '获取报纸的版面列表' })
  async getNewspaperSections(@Param('id') id: string) {
    return this.newspaperService.getNewspaperSections(id);
  }

  @Post(':id/sections')
  @Log("报纸", "版面", ":id/sections")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建报纸版面' })
  async createNewspaperSection(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminCreateNewspaperSection(id, dto);
  }

  @Put(':id/sections/:sectionId')
  @Log("报纸", "版面", ":id/sections/:sectionId")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新报纸版面' })
  async updateNewspaperSection(@Param('id') id: string, @Param('sectionId') sectionId: string, @Body() dto: any) {
    return this.newspaperService.adminUpdateNewspaperSection(id, sectionId, dto);
  }

  @Delete(':id/sections/:sectionId')
  @Log("报纸", "版面", ":id/sections/:sectionId")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除报纸版面' })
  async deleteNewspaperSection(@Param('id') id: string, @Param('sectionId') sectionId: string) {
    return this.newspaperService.adminDeleteNewspaperSection(id, sectionId);
  }
}
