import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookkeepingService } from './bookkeeping.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('代理记账套餐')
@Controller('bookkeeping/packages')
export class BookkeepingPackageController {
  constructor(private readonly bookkeepingService: BookkeepingService) {}

  @Get()
  @ApiOperation({ summary: '获取套餐列表' })
  async getList(@Query() query: { taxpayerType?: string; status?: number }) {
    return this.bookkeepingService.getPackageList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取套餐详情' })
  async getDetail(@Param('id') id: string) {
    return this.bookkeepingService.getPackageDetail(id);
  }

  @Post()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建套餐' })
  async create(@Body() body: any) {
    return this.bookkeepingService.createPackage(body);
  }

  @Put(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新套餐' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.bookkeepingService.updatePackage(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除套餐' })
  async delete(@Param('id') id: string) {
    return this.bookkeepingService.deletePackage(id);
  }
}
