import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { WechatService } from './wechat.service';
import { WechatController } from './wechat.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => OrderModule)],
  controllers: [WechatController],
  providers: [WechatService],
  exports: [WechatService],
})
export class WechatModule {}
