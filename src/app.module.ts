import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { Keyv } from 'keyv';
import { Keyv as KeyvMemory } from 'keyv';
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
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { ContentModule } from './modules/content/content.module';
import { MenuRoleModule } from './modules/menu-role/menu-role.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { FinanceModule } from './modules/finance/finance.module';
import { RefundModule } from './modules/refund/refund.module';
import { OutletPricingModule } from './modules/outlet-pricing/outlet-pricing.module';
import { OperationLogInterceptor } from './common/interceptors/operation-log.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 内存缓存（开发/无 Redis 时使用）；生产有 Redis 时改为 redis://localhost:6379
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const store = new KeyvMemory({ namespace: 'rc' });
        return {
          stores: [store],
          ttl: 60 * 1000,
        };
      },
    }),
    // ⚠️ 压测/大并发时临时调高；生产环境可根据实际流量调回 500-1000
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10000 }]),
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
    DispatchModule,
    ContentModule,
    MenuRoleModule,
    SettlementModule,
    TransactionModule,
    FinanceModule,
    RefundModule,
    OutletPricingModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
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
