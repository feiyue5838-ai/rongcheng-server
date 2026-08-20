import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtAuthGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkipWrap } from '../../common/decorators/skip-wrap.decorator';
import { AfterSalesService } from './after-sales.service';

@ApiTags('After-Sales')
@Controller('after-sales')
export class AfterSalesController {
  constructor(private readonly afterSalesService: AfterSalesService) {}

  // ==================== User-facing APIs ====================

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My after-sales records' })
  getMyAfterSales(@Request() req, @Query() query: { page?: string; pageSize?: string }) {
    return this.afterSalesService.getUserAfterSales(req.user.id, {
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Get('user/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My after-sales detail' })
  getMyAfterSalesDetail(@Request() req, @Param('id') id: string) {
    return this.afterSalesService.getUserAfterSalesDetail(req.user.id, id);
  }

  @Post('user/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel my after-sales (pending only, restore before-status)' })
  cancelMyAfterSales(@Request() req, @Param('id') id: string) {
    return this.afterSalesService.cancelAfterSales(req.user.id, id);
  }

  // ==================== Admin APIs ====================

  @Get('orders')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'After-sales orders list (admin)' })
  getAfterSalesOrders(@Query() query: { module?: string; page?: string; pageSize?: string }) {
    return this.afterSalesService.getAfterSalesOrders({
      module: query.module,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Post('orders/:id/confirm-refund')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm refund (after-sales -> refunding)' })
  confirmRefund(
    @Param('id') id: string,
    @Body() body: { amount?: number },
    @Req() req: any,
  ) {
    return this.afterSalesService.confirmRefund(id, body?.amount, req.user?.id);
  }

  @Post('orders/:id/reject')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @SkipWrap()
  @ApiOperation({ summary: 'Reject after-sales (after-sales -> completed)' })
  rejectAfterSales(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    if (!body.reason?.trim()) {
      return { code: 400, message: 'Please provide a rejection reason' };
    }
    return this.afterSalesService.rejectAfterSales(id, body.reason.trim(), req.user?.id);
  }

  @Get('refund-records')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund records (admin)' })
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