import { Controller, Get, Post, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BookkeepingService } from './bookkeeping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('代理记账')
@Controller('bookkeeping')
export class BookkeepingController {
  constructor(private readonly bookkeepingService: BookkeepingService) {}

  @Get('price')
  @ApiOperation({ summary: '获取代理记账价格' })
  async getPrice(@Query() q: { taxpayerType: string; cycle: string; invoice: string; social: string; fund: string }) {
    return this.bookkeepingService.getPrice({
      taxpayerType: q.taxpayerType as any,
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
        taxpayerType: body.taxpayerType,
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

  // ==================== 管理端 ====================

  @Get('orders')
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
