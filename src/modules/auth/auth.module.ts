import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { StoreJwtStrategy } from './strategies/store-jwt.strategy';
import { PrismaModule } from '../../prisma/prisma.module';
import { WechatModule } from '../wechat/wechat.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'rongcheng-jwt-secret-2024',
        signOptions: { expiresIn: '7d' },
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
