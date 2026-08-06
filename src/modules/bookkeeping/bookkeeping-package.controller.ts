// @ts-nocheck
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookkeepingService } from './bookkeeping.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** 将前端 camelCase 字段转成后端 Prisma snake_case */
function normalize(data: any): any {
  if (!data) return data;
  const map: Record<string, string> = {
    taxpayerType: 'taxpayer_type',
    invoicePrice: 'invoice_price',
    invoicePriceNormal: 'invoice_price_normal',
    socialPrice: 'social_price',
    fundPrice: 'fund_price',
    basePrice: 'base_price',
    sort: 'sort',
    status: 'status',
    name: 'name',
    cycle: 'cycle',
    description: 'description',
    features: 'features',
  };
  const result: any = {};
  for (const [k, v] of Object.entries(data)) {
    result[map[k] ?? k] = v;
  }
  return result;
}

@ApiTags('代理记账套餐')
@Controller('bookkeeping/packages')
export class BookkeepingPackageController {
  constructor(private readonly bookkeepingService: BookkeepingService) {}

  @Get()
  @ApiOperation({ summary: '获取套餐列表' })
  async getList(@Query() query: { taxpayer_type?: string; status?: number }) {
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
    return this.bookkeepingService.createPackage(normalize(body));
  }

  @Put(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新套餐' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.bookkeepingService.updatePackage(id, normalize(body));
  }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除套餐' })
  async delete(@Param('id') id: string) {
    return this.bookkeepingService.deletePackage(id);
  }
}
