import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { NotificationModule } from './modules/notification/notification.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { QuestionModule } from './modules/question/question.module';
import { AfterSalesModule } from './modules/after-sales/after-sales.module';
import { BookkeepingModule } from './modules/bookkeeping/bookkeeping.module';
import { OperationLogInterceptor } from './common/interceptors/operation-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]), // 全局限流：60次/分钟
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
    NotificationModule,
    DeliveryModule,
    DashboardModule,
    QuestionModule,
    AfterSalesModule,
    BookkeepingModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: OperationLogInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
