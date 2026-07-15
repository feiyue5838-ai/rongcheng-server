import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NewspaperService } from './newspaper.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('登报')
@Controller('newspapers')
export class NewspaperController {
  constructor(private readonly newspaperService: NewspaperService) {}

  @Get('categories')
  @ApiOperation({ summary: '获取登报分类' })
  async getCategories() {
    return this.newspaperService.getCategories();
  }

  @Post('categories')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建登报分类' })
  async createCategory(@Body() dto: any) {
    return this.newspaperService.adminCreateCategory(dto);
  }

  @Put('categories/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新登报分类' })
  async updateCategory(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminUpdateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除登报分类' })
  async deleteCategory(@Param('id') id: string) {
    return this.newspaperService.adminDeleteCategory(id);
  }

  @Get()
  @ApiOperation({ summary: '获取报纸列表' })
  async getNewspapers(@Query() query: any) {
    return this.newspaperService.getNewspapers(query);
  }

  @Get('templates')
  @ApiOperation({ summary: '获取登报模板' })
  async getTemplates(@Query('newspaperId') newspaperId?: string, @Query('categoryId') categoryId?: string) {
    return this.newspaperService.getTemplates(newspaperId, categoryId);
  }

  @Get('price')
  @ApiOperation({ summary: '计算登报价格（含期数）' })
  async calculatePrice(@Query('newspaperId') newspaperId: string, @Query('contentLength') contentLength: number, @Query('issueCount') issueCount?: number) {
    return this.newspaperService.calculatePrice(newspaperId, contentLength, issueCount);
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
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新报纸' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminUpdateNewspaper(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除报纸' })
  async delete(@Param('id') id: string) {
    return this.newspaperService.adminDeleteNewspaper(id);
  }

  @Post('templates')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建模板' })
  async createTemplate(@Body() dto: any) {
    return this.newspaperService.adminCreateTemplate(dto);
  }

  @Put('templates/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新模板' })
  async updateTemplate(@Param('id') id: string, @Body() dto: any) {
    return this.newspaperService.adminUpdateTemplate(id, dto);
  }
}
