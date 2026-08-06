import { Module } from '@nestjs/common';
import { OutletPricingService } from './outlet-pricing.service';
import { OutletPricingController } from './outlet-pricing.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OutletPricingController],
  providers: [OutletPricingService],
  exports: [OutletPricingService],
})
export class OutletPricingModule {}
