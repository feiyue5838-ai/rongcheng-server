import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { StoreJwtStrategy } from './strategies/Outlet-jwt.strategy';
import { PrismaModule } from '../../prisma/prisma.module';
import { WechatModule } from '../wechat/wechat.module';
import { UserModule } from '../user/user.module';
import { JWT_SECRET, JWT_SECRET_ADMIN, JWT_SECRET_OUTLET } from '../../common/config/jwt.config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // A-03: 三类主体使用独立密钥
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: JWT_SECRET,
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d' },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    WechatModule,
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AdminJwtStrategy, StoreJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

// 导出独立密钥供各 Strategy 使用
export { JWT_SECRET, JWT_SECRET_ADMIN, JWT_SECRET_OUTLET };
