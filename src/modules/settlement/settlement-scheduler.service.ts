import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SettlementService } from './settlement.service';

@Injectable()
export class SettlementSchedulerService {
  private readonly logger = new Logger(SettlementSchedulerService.name);

  constructor(private readonly settlementService: SettlementService) {}

  /**
   * 每天 00:05（上海时区，见 ecosystem.config.js TZ）触发。
   * 内部按各网点配置的周期（daily/weekly/monthly）判断今天是否应结算，
   * 命中则生成「待确认」结算单，打款仍需人工在后台确认。
   */
  @Cron('5 0 * * *', { name: 'settlement-scheduled' })
  async handleScheduledSettlement() {
    try {
      const results = await this.settlementService.runScheduledSettlement();
      const ok = results.filter((r: any) => r.ok).length;
      const fail = results.length - ok;
      this.logger.log(`[定时结算] 完成 成功=${ok} 失败=${fail} 明细=${JSON.stringify(results)}`);
    } catch (err: any) {
      this.logger.error(`[定时结算] 执行异常：${err?.message}`);
    }
  }
}
