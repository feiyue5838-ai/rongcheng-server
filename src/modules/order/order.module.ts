import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { SealModule } from '../seal/seal.module';
import { WechatModule } from '../wechat/wechat.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [PrismaModule, SealModule, DispatchModule, forwardRef(() => WechatModule)],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
