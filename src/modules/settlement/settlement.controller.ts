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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('结算管理')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('settlement')
export class SettlementController {
  constructor(private settlementService: SettlementService) {}

  // ==================== 结算规则 ====================

  @Get('rules')
  @ApiOperation({ summary: '获取结算规则列表' })
  async getRules() {
    const rules = await this.settlementService.getRules();
    return { code: 0, data: rules };
  }

  @Get('rules/default')
  @ApiOperation({ summary: '获取默认结算规则' })
  async getDefaultRule() {
    const rule = await this.settlementService.getDefaultRule();
    return { code: 0, data: rule };
  }

  @Post('rules')
  @ApiOperation({ summary: '创建结算规则' })
  async createRule(@Body() body: any, @Request() req: any) {
    // F-05: 操作人从 JWT 取，不用前端 query 参数
    const rule = await this.settlementService.createRule(body, req.user?.id);
    return { code: 0, data: rule };
  }

  @Put('rules/:id')
  @ApiOperation({ summary: '更新结算规则' })
  async updateRule(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    // F-05: 操作人从 JWT 取
    const rule = await this.settlementService.updateRule(id, body, req.user?.id);
    return { code: 0, data: rule };
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: '删除结算规则' })
  async deleteRule(@Param('id') id: string) {
    await this.settlementService.deleteRule(id);
    return { code: 0, message: '删除成功' };
  }

  // ==================== 结算记录 ====================

  @Get('records')
  @ApiOperation({ summary: '获取结算记录列表' })
  async getRecords(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('outletId') outletId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.settlementService.getRecords({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      outletId,
      status: status ? Number(status) : undefined,
      startDate,
      endDate,
    });
    return { code: 0, data: result };
  }

  @Get('records/export')
  @ApiOperation({ summary: '导出结算对账单' })
  async exportRecords(
    @Query('outletId') outletId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const records = await this.settlementService.exportRecords({
      outletId,
      status: status ? Number(status) : undefined,
      startDate,
      endDate,
    });
    return { code: 0, data: records };
  }

  @Get('records/:id')
  @ApiOperation({ summary: '获取结算记录详情' })
  async getRecordDetail(@Param('id') id: string) {
    const record = await this.settlementService.getRecordDetail(id);
    return { code: 0, data: record };
  }

  @Post('records')
  @ApiOperation({ summary: '生成本周期结算记录' })
  async generateRecord(@Body() body: any, @Request() req: any) {
    // F-05: 操作人从 JWT 取
    const record = await this.settlementService.generateRecord({
      ...body,
      userId: req.user?.id,
    });
    return { code: 0, data: record };
  }

  @Post('records/auto-generate')
  @ApiOperation({ summary: '批量自动生成结算记录' })
  async autoGenerateRecords(@Body() body: any, @Request() req: any) {
    // F-05: 操作人从 JWT 取
    const results = await this.settlementService.autoGenerateRecords({
      ...body,
      userId: req.user?.id,
    });
    return { code: 0, data: results };
  }

  @Post('records/trigger-scheduled')
  @ApiOperation({ summary: '手动触发定时结算（测试/人工触发）' })
  async triggerScheduledSettlement(@Request() req: any) {
    // 操作人从 JWT 取，admin 可手动触发任意网点的定时结算
    const results = await this.settlementService.runScheduledSettlement();
    return { code: 0, data: results, message: `共 ${results.length} 个网点命中定时条件` };
  }

  @Put('records/:id/status')
  @ApiOperation({ summary: '更新结算状态' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: number; remark?: string },
    @Request() req: any,
  ) {
    // F-05: 操作人从 JWT 取
    const record = await this.settlementService.updateStatus(
      id,
      body.status,
      req.user?.id,
      body.remark,
    );
    return { code: 0, data: record };
  }

  @Delete('records/:id')
  @ApiOperation({ summary: '删除结算记录' })
  async deleteRecord(@Param('id') id: string) {
    await this.settlementService.deleteRecord(id);
    return { code: 0, message: '删除成功' };
  }

  @Get('outlets/summary')
  @ApiOperation({ summary: '获取网点结算汇总' })
  async getOutletSummary() {
    const summary = await this.settlementService.getOutletSummary();
    return { code: 0, data: summary };
  }

  @Get('outlets/pending')
  @ApiOperation({ summary: '获取服务商待结算汇总' })
  async getOutletPendingSummary() {
    const summary = await this.settlementService.getOutletPendingSummary();
    return { code: 0, data: summary };
  }
}
