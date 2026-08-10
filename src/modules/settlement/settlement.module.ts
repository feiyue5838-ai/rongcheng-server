import { Module } from '@nestjs/common';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';
import { SettlementSchedulerService } from './settlement-scheduler.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SettlementController],
  providers: [SettlementService, SettlementSchedulerService],
  exports: [SettlementService],
})
export class SettlementModule {}
