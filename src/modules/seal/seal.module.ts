import { Module } from '@nestjs/common';
import { SealController } from './seal.controller';
import { SealService } from './seal.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SealController],
  providers: [SealService],
  exports: [SealService],
})
export class SealModule {}
