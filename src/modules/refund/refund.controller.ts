import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RefundService } from './refund.service';

@ApiTags('退款管理')
@Controller('refund')
@UseGuards(AdminJwtAuthGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post('apply')
  @ApiOperation({ summary: '发起退款申请' })
  async apply(@Body() body: { orderId: string; amount?: number; reason?: string }, @Request() req: any) {
    return this.refundService.apply(body.orderId, body.amount, body.reason, req.user?.userId);
  }

  @Get('list')
  @ApiOperation({ summary: '退款申请列表' })
  async list(@Query() query: { status?: number; page?: number; pageSize?: number }) {
    return this.refundService.list(query);
  }

  @Post(':id/review')
  @ApiOperation({ summary: '审核退款申请' })
  async review(@Param('id') id: string, @Body() body: { status: 2 | 4; reviewNote?: string }, @Request() req: any) {
    return this.refundService.review(id, body.status, body.reviewNote, req.user?.userId);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: '执行退款' })
  async execute(@Param('id') id: string, @Request() req: any) {
    return this.refundService.execute(id, req.user?.userId);
  }
}
