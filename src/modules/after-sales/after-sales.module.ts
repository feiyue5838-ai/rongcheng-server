import { Module } from '@nestjs/common';
import { AfterSalesController } from './after-sales.controller';
import { AfterSalesService } from './after-sales.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [PrismaModule, OrderModule],
  controllers: [AfterSalesController],
  providers: [AfterSalesService],
  exports: [AfterSalesService],
})
export class AfterSalesModule {}
