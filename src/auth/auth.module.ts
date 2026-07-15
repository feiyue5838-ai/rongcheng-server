import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from '../modules/auth/strategies/jwt.strategy';
import { AdminJwtStrategy } from '../modules/auth/strategies/admin-jwt.strategy';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'rongcheng-jwt-secret-2024',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy, AdminJwtStrategy, JwtAuthGuard, AdminJwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, AdminJwtAuthGuard],
})
export class AuthModule {}
