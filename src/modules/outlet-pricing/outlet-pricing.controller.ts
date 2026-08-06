import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OutletPricingService } from './outlet-pricing.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('合作价格管理')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('outlet-pricing')
export class OutletPricingController {
  constructor(private pricingService: OutletPricingService) {}

  @Get('list')
  @ApiOperation({ summary: '获取合作价格列表' })
  async getList(
    @Query('outletId') outletId?: string,
    @Query('businessType') businessType?: string,
    @Query('status') status?: string,
  ) {
    const list = await this.pricingService.getAllPricings({
      outletId,
      businessType,
      status: status !== undefined ? Number(status) : undefined,
    });
    return { code: 0, data: list };
  }

  @Get('outlet/:outletId')
  @ApiOperation({ summary: '获取某网点合作价格' })
  async getByOutlet(@Param('outletId') outletId: string) {
    const list = await this.pricingService.getPricingsByOutlet(outletId);
    return { code: 0, data: list };
  }

  @Post('upsert')
  @ApiOperation({ summary: '创建/更新合作价格' })
  async upsert(
    @Body()
    body: {
      outletId: string;
      businessType: string;
      unit: string;
      priceType: 'fixed' | 'percent';
      priceValue: number;
      status?: number;
      remark?: string;
    },
  ) {
    const data = await this.pricingService.upsertPricing(body);
    return { code: 0, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除合作价格' })
  async remove(@Param('id') id: string) {
    await this.pricingService.deletePricing(id);
    return { code: 0, message: '删除成功' };
  }
}
