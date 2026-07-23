import { Module } from '@nestjs/common';
import { BookkeepingController } from './bookkeeping.controller';
import { BookkeepingPackageController } from './bookkeeping-package.controller';
import { BookkeepingService } from './bookkeeping.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WechatModule } from '../wechat/wechat.module';

@Module({
  imports: [PrismaModule, WechatModule],
  controllers: [BookkeepingController, BookkeepingPackageController],
  providers: [BookkeepingService],
  exports: [BookkeepingService],
})
export class BookkeepingModule {}
