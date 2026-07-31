import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('系统配置')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: '获取配置' })
  async getConfig(@Query('key') key: string) {
    return this.configService.getConfig(key);
  }

  @Get('all')
  @ApiOperation({ summary: '获取所有配置' })
  async getAllConfigs(@Query('group') group?: string) {
    return this.configService.getAllConfigs(group);
  }

  @Put()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置配置' })
  @Log('系统', '更新配置')
  async setConfig(@Body() dto: { key: string; value: any; name?: string; group?: string }) {
    return this.configService.setConfig(dto.key, dto.value, dto.name, dto.group);
  }
}
