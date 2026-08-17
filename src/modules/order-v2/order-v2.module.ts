import { Module } from '@nestjs/common';
import { OrderV2Controller } from './controllers/user.controller';
import { SupplierController } from './controllers/supplier.controller';
import { AdminController } from './controllers/admin.controller';
import { PaymentsV2Controller } from './controllers/payments.controller';
import { OrderV2Service } from './services/order-v2.service';
import { FulfillmentService } from './services/fulfillment.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrderV2Controller, SupplierController, AdminController, PaymentsV2Controller],
  providers: [OrderV2Service, FulfillmentService],
  exports: [OrderV2Service, FulfillmentService],
})
export class OrderV2Module {}
