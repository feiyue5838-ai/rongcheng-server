import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NewspaperController } from './newspaper.controller';
import { NewspaperService } from './newspaper.service';

@Module({
  imports: [PrismaModule],
  controllers: [NewspaperController],
  providers: [NewspaperService],
  exports: [NewspaperService],
})
export class NewspaperModule {}
