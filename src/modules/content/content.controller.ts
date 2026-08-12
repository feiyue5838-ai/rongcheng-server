import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('内容管理')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // ==================== Banner ====================
  @Get('banners')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Banner 列表' })
  async listBanners() {
    return this.contentService.listBanners();
  }

  @Post('banners')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增 Banner' })
  @Log('内容', '新增Banner')
  async createBanner(@Body() dto: { title: string; image: string; link?: string; sort?: number; status?: number }) {
    return this.contentService.createBanner(dto);
  }

  @Put('banners/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑 Banner' })
  @Log('内容', '编辑Banner')
  async updateBanner(@Param('id') id: string, @Body() dto: any) {
    return this.contentService.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除 Banner' })
  @Log('内容', '删除Banner')
  async deleteBanner(@Param('id') id: string) {
    return this.contentService.deleteBanner(id);
  }

  // ==================== Announcement ====================
  @Get('announcements')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '公告列表' })
  async listAnnouncements(@Query() query: { status?: string; keyword?: string }) {
    return this.contentService.listAnnouncements(query);
  }

  @Post('announcements')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增公告' })
  @Log('内容', '新增公告')
  async createAnnouncement(@Body() dto: any, @Req() req: any) {
    const operator = req.user?.username ?? null;
    return this.contentService.createAnnouncement({ ...dto, operator });
  }

  @Put('announcements/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑公告' })
  @Log('内容', '编辑公告')
  async updateAnnouncement(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    const operator = req.user?.username ?? null;
    return this.contentService.updateAnnouncement(id, { ...dto, operator });
  }

  @Delete('announcements/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除公告' })
  @Log('内容', '删除公告')
  async deleteAnnouncement(@Param('id') id: string) {
    return this.contentService.deleteAnnouncement(id);
  }

  // ==================== Intro ====================
  @Get('intros')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '业务介绍列表' })
  async listIntros() {
    return this.contentService.listIntros();
  }

  @Post('intros')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增业务介绍' })
  @Log('内容', '新增业务介绍')
  async createIntro(@Body() dto: { title: string; subtitle?: string; image: string; sort?: number; status?: number }) {
    return this.contentService.createIntro(dto);
  }

  @Put('intros/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑业务介绍' })
  @Log('内容', '编辑业务介绍')
  async updateIntro(@Param('id') id: string, @Body() dto: any) {
    return this.contentService.updateIntro(id, dto);
  }

  @Delete('intros/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除业务介绍' })
  @Log('内容', '删除业务介绍')
  async deleteIntro(@Param('id') id: string) {
    return this.contentService.deleteIntro(id);
  }
}