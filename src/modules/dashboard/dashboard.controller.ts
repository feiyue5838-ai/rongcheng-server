import { Controller, Get, Post, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly prisma: PrismaService,
  ) {}

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

  // --- 派单记录接口 ---
  @Get('dispatch-records')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '派单记录列表' })
  async getDispatchRecords(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('orderNo') orderNo?: string,
    @Query('assignedBy') assignedBy?: string,
    @Query('outletId') outletId?: string,
    @Query('status') status?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const pageN = Number(page) || 1;
    const pageSizeN = Number(pageSize) || 20;
    const skip = (pageN - 1) * pageSizeN;
    const rawWhere = [
      orderNo ? `AND so.order_no ILIKE '%${orderNo.replace(/'/g, "''")}%'` : '',
      outletId ? `AND oa.outlet_id = '${outletId}'` : '',
      (status !== undefined && status !== null && !Number.isNaN(Number(status))) ? `AND oa.status = ${Number(status)}` : '',
      assignedBy ? `AND oa.assigned_by = '${assignedBy.replace(/'/g, "''")}'` : '',
      startDate ? `AND oa.assigned_at >= '${startDate}'` : '',
      endDate ? `AND oa.assigned_at <= '${endDate}T23:59:59'` : '',
    ].join(' ');
    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT oa.id, oa.order_id, oa.outlet_id, oa.status as assign_status, oa.status_text,
                oa.assigned_by, oa.assigned_at, oa.accepted_at, oa.completed_at, oa.remark,
                so.order_no, so.company_name, so.contact_phone,
                o.name as outlet_name,
                CASE WHEN oa.assigned_by = 'system' THEN '自动派单' ELSE '手动派单' END as assign_type,
                GREATEST(0, EXTRACT(EPOCH FROM (oa.accepted_at - oa.assigned_at))/60) as accept_minutes
         FROM order_assignments oa
         JOIN seal_orders so ON so.id = oa.order_id
         JOIN outlets o ON o.id = oa.outlet_id
         WHERE 1=1 ${rawWhere}
         ORDER BY oa.assigned_at DESC
         LIMIT ${pageSizeN} OFFSET ${skip}`,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as cnt FROM order_assignments oa
         JOIN seal_orders so ON so.id = oa.order_id
         WHERE 1=1 ${rawWhere}`,
      ),
    ]);
    const total = Number(countRows[0]?.cnt || 0);
    return { code: 0, data: { list: rows.map(r => ({ ...r, assignStatus: r.assign_status, assignType: r.assign_type, acceptMinutes: r.accept_minutes ? Number(r.accept_minutes) : null })), pagination: { page: pageN, pageSize: pageSizeN, total, totalPages: Math.ceil(total / pageSizeN) } } };
  }

  @Get('dispatch-stats')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '派单统计' })
  async getDispatchStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('outletId') outletId?: string,
    @Query('assignedBy') assignedBy?: string,
  ) {
    const [total, rows] = await Promise.all([
      this.prisma.order_assignments.count({ where: { outlet_id: outletId || undefined, assigned_by: assignedBy || undefined } }),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*) FILTER (WHERE assigned_by = 'system') as auto_count,
               COUNT(*) FILTER (WHERE assigned_by != 'system') as manual_count,
               ROUND(AVG(GREATEST(0, EXTRACT(EPOCH FROM (accepted_at - assigned_at))/60)) FILTER (WHERE accepted_at IS NOT NULL), 1) as avg_accept_minutes
        FROM order_assignments oa
        JOIN seal_orders so ON so.id = oa.order_id
        ${outletId ? `JOIN outlets o ON o.id = oa.outlet_id AND o.id = '${outletId}'` : ''}
        WHERE 1=1 ${startDate ? ` AND oa.assigned_at >= '${startDate}'` : ''} ${endDate ? ` AND oa.assigned_at <= '${endDate}T23:59:59'` : ''}
      `),
    ]);
    const stats = rows[0] || {};
    return { code: 0, data: { total, autoCount: Number(stats.auto_count || 0), manualCount: Number(stats.manual_count || 0), avgAcceptMinutes: stats.avg_accept_minutes ? Number(stats.avg_accept_minutes) : null } };
  }
}
