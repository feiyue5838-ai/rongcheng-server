import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { AfterSalesService } from './after-sales.service';

@ApiTags('售后管理')
@UseGuards(AdminJwtAuthGuard)
@Controller('after-sales')
export class AfterSalesController {
  constructor(private readonly afterSalesService: AfterSalesService) {}

  @Get('orders')
  @ApiOperation({ summary: '售后中订单列表' })
  getAfterSalesOrders(@Query() query: { module?: string; page?: string; pageSize?: string }) {
    return this.afterSalesService.getAfterSalesOrders({
      module: query.module,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Post('orders/:id/confirm-refund')
  @ApiOperation({ summary: '确认退款（售后→退款中）' })
  confirmRefund(
    @Param('id') id: string,
    @Body() body: { amount?: number },
    @Req() req: any,
  ) {
    return this.afterSalesService.confirmRefund(id, body?.amount, req.user?.id);
  }

  @Post('orders/:id/reject')
  @ApiOperation({ summary: '拒绝售后（售后→已完成）' })
  rejectAfterSales(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    if (!body.reason?.trim()) {
      return { code: 400, message: '请填写拒绝原因' };
    }
    return this.afterSalesService.rejectAfterSales(id, body.reason.trim(), req.user?.id);
  }

  @Get('refund-records')
  @ApiOperation({ summary: '退款记录' })
  getRefundRecords(@Query() query: {
    module?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    pageSize?: string;
  }) {
    return this.afterSalesService.getRefundRecords({
      module: query.module,
      status: query.status ? Number(query.status) : undefined,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }
}
