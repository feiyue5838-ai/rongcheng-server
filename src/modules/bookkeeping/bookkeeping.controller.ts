import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookkeepingService } from './bookkeeping.service';
import { JwtAuthGuard, AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('代理记账')
@Controller('bookkeeping')
export class BookkeepingController {
  constructor(private readonly bookkeepingService: BookkeepingService) {}

  @Get('price')
  @ApiOperation({ summary: '获取代理记账价格' })
  async getPrice(@Query() q: { taxpayer_type: string; cycle: string; invoice: string; social: string; fund: string }) {
    return this.bookkeepingService.getPrice({
      taxpayer_type: q.taxpayer_type as any,
      cycle: q.cycle as any,
      invoice: q.invoice as any,
      social: q.social as any,
      fund: q.fund as any,
    });
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @Log('代理记账', '创建订单')
  @ApiOperation({ summary: '创建代理记账订单' })
  async createOrder(@Body() body: any, @Request() req: any) {
    return this.bookkeepingService.createOrder(
      {
        taxpayer_type: body.taxpayer_type,
        cycle: body.cycle,
        invoice: body.invoice,
        social: body.social,
        fund: body.fund,
        phone: body.phone,
        price: body.price,
      },
      req.user.id,
    );
  }

  @Post('orders/:id/pay-params')
  @UseGuards(JwtAuthGuard)
  @Log('代理记账', '获取支付参数')
  @ApiOperation({ summary: '获取代理记账订单支付参数' })
  async getPayParams(@Param('id') id: string, @Request() req: any, @Body() body: { openid?: string }) {
    return this.bookkeepingService.getPayParams(id, req.user.id, body.openid);
  }

  // ==================== 套餐管理（管理端）====================

  @Get('packages')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '代理记账套餐列表' })
  async getPackages() {
    return this.bookkeepingService.getPackageList({});
  }

  @Post('packages')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('代理记账', '创建套餐')
  @ApiOperation({ summary: '创建代理记账套餐' })
  async createPackage(@Body() dto: any) {
    return this.bookkeepingService.createPackage(dto);
  }

  @Put('packages/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('代理记账', '更新套餐')
  @ApiOperation({ summary: '更新代理记账套餐' })
  async updatePackage(@Param('id') id: string, @Body() dto: any) {
    return this.bookkeepingService.updatePackage(id, dto);
  }

  @Delete('packages/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @Log('代理记账', '删除套餐')
  @ApiOperation({ summary: '删除代理记账套餐' })
  async deletePackage(@Param('id') id: string) {
    return this.bookkeepingService.deletePackage(id);
  }

  // ==================== 管理端 ====================

  @Get('orders')
  @UseGuards(AdminJwtAuthGuard)
  @ApiOperation({ summary: '代理记账订单列表（管理端）' })
  async getOrders(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.bookkeepingService.getOrders({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
      status: status !== undefined ? Number(status) : undefined,
    });
  }
}
