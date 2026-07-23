import { Module } from '@nestjs/common';
import { BookkeepingController } from './bookkeeping.controller';
import { BookkeepingService } from './bookkeeping.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WechatModule } from '../wechat/wechat.module';

@Module({
  imports: [PrismaModule, WechatModule],
  controllers: [BookkeepingController],
  providers: [BookkeepingService],
  exports: [BookkeepingService],
})
export class BookkeepingModule {}
