import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WechatModule } from '../wechat/wechat.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [PrismaModule, WechatModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
