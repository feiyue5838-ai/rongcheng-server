import { Module } from '@nestjs/common';
import { OrderV2Controller } from './controllers/user.controller';
import { SupplierController } from './controllers/supplier.controller';
import { AdminController } from './controllers/admin.controller';
import { PaymentsV2Controller } from './controllers/payments.controller';
import { OrderV2Service } from './services/order-v2.service';
import { FulfillmentService } from './services/fulfillment.service';
import { SettlementV2Service } from './services/settlement.service';
import { WechatPayService } from './services/wechat-pay.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [OrderV2Controller, SupplierController, AdminController, PaymentsV2Controller],
  providers: [OrderV2Service, FulfillmentService, SettlementV2Service, WechatPayService],
  exports: [OrderV2Service, FulfillmentService, SettlementV2Service, WechatPayService],
})
export class OrderV2Module {}
