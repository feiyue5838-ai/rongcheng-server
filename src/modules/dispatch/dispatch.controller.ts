import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';
import { DispatchService } from './dispatch.service';

@ApiTags('派单规则')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('config')
  @Log('派单', '查看配置')
  @ApiOperation({ summary: '获取派单全局配置' })
  async getConfig() {
    return this.dispatchService.getConfig();
  }

  @Put('config')
  @Log('派单', '更新配置')
  @ApiOperation({ summary: '更新派单全局配置' })
  async updateConfig(@Body() dto: any, @Request() req: any) {
    return this.dispatchService.updateConfig(dto, req.user.id);
  }

  @Get('priorities')
  @ApiOperation({ summary: '获取网点优先级列表' })
  async getPriorities() {
    return this.dispatchService.getPriorities();
  }

  @Put('priorities/:outlet_id')
  @Log('派单', '设置优先级')
  @ApiOperation({ summary: '设置单个网点优先级' })
  async setPriority(
    @Param('outlet_id') outlet_id: string,
    @Body() dto: { priority: number; remark?: string }
  ) {
    return this.dispatchService.setPriority(outlet_id, dto.priority, dto.remark);
  }

  @Post('priorities/batch')
  @Log('派单', '批量设置优先级')
  @ApiOperation({ summary: '批量设置网点优先级' })
  async batchSetPriorities(@Body() body: { items: Array<{ outlet_id: string; priority: number }> }) {
    return this.dispatchService.batchSetPriorities(body.items || []);
  }

  @Get('forced-regions')
  @ApiOperation({ summary: '获取强制手动地区列表' })
  async getForcedRegions() {
    return this.dispatchService.getForcedManualRegions();
  }

  @Post('forced-regions')
  @Log('派单', '添加强制手动地区')
  @ApiOperation({ summary: '添加强制手动地区' })
  async addForcedRegion(@Body() dto: { province: string; city?: string; remark?: string }, @Request() req: any) {
    return this.dispatchService.addForcedManualRegion(dto.province, dto.city, dto.remark, req.user.id);
  }

  @Delete('forced-regions/:id')
  @Log('派单', '删除强制手动地区')
  @ApiOperation({ summary: '删除强制手动地区' })
  async removeForcedRegion(@Param('id') id: string) {
    return this.dispatchService.removeForcedManualRegion(id);
  }

  @Get('outlets/available')
  @ApiOperation({ summary: '获取可派单网点列表（带匹配分）' })
  async getAvailableOutlets(
    @Query('addressJson') addressJson?: string,
    @Query('businessType') businessType?: string
  ) {
    return this.dispatchService.getAvailableOutlets(addressJson, businessType);
  }
}
