import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderDDDController } from './order.ddd.controller';
import { OrderDDDService } from './order.ddd.service';
import { OrderRepository } from './repositories/order.repository';
import { PaymentRepository } from '../payment/repositories/payment.repository';
import { FulfillmentRepository } from '../fulfillment/repositories/fulfillment.repository';
import { SealModule } from '../seal/seal.module';
import { WechatModule } from '../wechat/wechat.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [PrismaModule, SealModule, DispatchModule, forwardRef(() => WechatModule)],
  controllers: [OrderController, OrderDDDController],
  providers: [
    OrderService,
    OrderDDDService,
    OrderRepository,
    PaymentRepository,
    FulfillmentRepository,
  ],
  exports: [OrderService, OrderDDDService],
})
export class OrderModule {}
