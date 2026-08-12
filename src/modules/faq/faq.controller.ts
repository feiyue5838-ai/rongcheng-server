import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FaqService } from './faq.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('帮助中心')
@Controller('faqs')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  // ===== 小程序端 =====

  /** 帮助中心（含分类/问答/电话） */
  @Get()
  @ApiOperation({ summary: '帮助中心（小程序端，含分类/问答/电话）' })
  async getPublicList() {
    return this.faqService.getPublicList();
  }

  /** 客服电话（公开） */
  @Get('phone')
  @ApiOperation({ summary: '客服电话（公开）' })
  async getPhone() {
    return { phone: await this.faqService.getPhoneValue() };
  }

  // ===== 管理端 =====

  @Get('admin/list')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '帮助中心列表（后台，含禁用）' })
  async adminList() {
    return this.faqService.adminList();
  }

  @Post('admin/category')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '新增分类', 'admin/category')
  async addCategory(@Body() dto: any) {
    return this.faqService.addCategory(dto);
  }

  @Put('admin/category/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '更新分类', 'admin/category/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: any) {
    return this.faqService.updateCategory(id, dto);
  }

  @Delete('admin/category/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '删除分类', 'admin/category/:id')
  async deleteCategory(@Param('id') id: string, @Body() dto: any) {
    return this.faqService.deleteCategory(id);
  }

  // ⚠️ admin/phone 必须放在 admin/:id 之前，否则 /admin/phone 会被 :id=phone 错误匹配
  @Put('admin/phone')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '设置客服电话', 'admin/phone')
  async setPhone(@Body() dto: any) {
    return this.faqService.setPhone(dto.phone);
  }

  @Post('admin')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '新增问答', 'admin')
  async addFaq(@Body() dto: any) {
    return this.faqService.addFaq(dto);
  }

  @Put('admin/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '更新问答', 'admin/:id')
  async updateFaq(@Param('id') id: string, @Body() dto: any) {
    return this.faqService.updateFaq(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '删除问答', 'admin/:id')
  async deleteFaq(@Param('id') id: string) {
    return this.faqService.deleteFaq(id);
  }

  @Put('admin/:id/status')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '更新问答状态', 'admin/:id/status')
  async updateFaqStatus(@Param('id') id: string, @Body() dto: any) {
    return this.faqService.updateFaqStatus(id, dto.status);
  }

  @Put('admin/category/:id/status')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('帮助中心', '更新分类状态', 'admin/category/:id/status')
  async updateCategoryStatus(@Param('id') id: string, @Body() dto: any) {
    return this.faqService.updateCategoryStatus(id, dto.status);
  }

  @Get('admin/phone')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '客服电话（后台）' })
  async getPhoneAdmin() {
    return { phone: await this.faqService.getPhoneValue() };
  }
}
