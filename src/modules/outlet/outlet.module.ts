import { Module } from '@nestjs/common';
import { StoreController } from './Outlet.controller';
import { StoreService } from './Outlet.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
