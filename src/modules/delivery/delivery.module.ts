import { Module } from '@nestjs/common';
import { DeliveryReceiptController } from './delivery.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [DeliveryReceiptController],
})
export class DeliveryModule {}
