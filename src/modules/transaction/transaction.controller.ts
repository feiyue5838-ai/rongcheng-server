import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('transaction')
@UseGuards(AdminJwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  /** 交易统计概览 */
  @Get('stats')
  async getStats(@Query() query: { startDate?: string; endDate?: string }) {
    return { data: await this.transactionService.getStats(query) };
  }

  /** 按业务类型统计 */
  @Get('stats/by-module')
  async getStatsByModule(@Query() query: { startDate?: string; endDate?: string }) {
    return { data: await this.transactionService.getStatsByModule(query) };
  }

  /** 交易流水列表 */
  @Get('flows')
  async getFlows(@Query() query: {
    page?: string;
    pageSize?: string;
    module?: string;
    tradeType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
    outletId?: string;
  }) {
    const params = {
      page: query.page ? parseInt(query.page) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
      module: query.module,
      tradeType: query.tradeType,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
      keyword: query.keyword,
      outletId: query.outletId,
    };
    return { data: await this.transactionService.getFlows(params) };
  }

  /** 流水详情 */
  @Get('flows/:id')
  async getFlowById(@Param('id') id: string) {
    return { data: await this.transactionService.getFlowById(id) };
  }

  /** 导出交易流水 */
  @Get('export')
  async exportFlows(@Query() query: any) {
    const data = await this.transactionService.exportFlows(query);
    return { data, filename: `交易流水_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx` };
  }

  /** 获取有流水的履约供应商列表 */
  @Get('outlets-with-flows')
  async getOutletsWithFlows() {
    return { data: await this.transactionService.getOutletsWithFlows() };
  }
}
