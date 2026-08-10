import { Controller, Get, Post, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取控制台统计数据' })
  async getDashboard(@Request() req) {
    return this.dashboardService.getDashboard();
  }

  @Get('trend')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取近7天趋势数据（订单量/金额）' })
  async getTrend(
    @Query('type') type: 'order' | 'amount' = 'order',
    @Query('days') days: string = '7',
  ) {
    const daysNum = Math.min(Math.max(parseInt(days, 10) || 7, 1), 30);
    return this.dashboardService.getTrend(type, daysNum);
  }

  @Post('customer-action')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '客户运营动作（推送/唤醒/客服），预留微信推送集成' })
  async customerAction(@Body() body: { action: string; segment: string }) {
    return this.dashboardService.customerAction(body);
  }
}
