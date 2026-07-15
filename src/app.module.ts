import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrderModule } from './modules/order/order.module';
import { SealModule } from './modules/seal/seal.module';
import { NewspaperModule } from './modules/newspaper/newspaper.module';
import { UserModule } from './modules/user/user.module';
import { ReviewModule } from './modules/review/review.module';
import { UploadModule } from './modules/upload/upload.module';
import { ConfigModule as SysConfigModule } from './modules/config/config.module';
import { AdminModule } from './modules/admin/admin.module';
import { StoreModule } from './modules/Outlet/Outlet.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrderModule,
    SealModule,
    NewspaperModule,
    UserModule,
    ReviewModule,
    UploadModule,
    SysConfigModule,
    AdminModule,
    StoreModule,
    DeliveryModule,
    DashboardModule,
  ],
})
export class AppModule {}
