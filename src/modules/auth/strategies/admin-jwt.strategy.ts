// @ts-nocheck
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'rongcheng-jwt-secret-2024',
    });
  }

  async validate(payload: any) {
    if (payload.type !== 'admin') {
      throw new UnauthorizedException('无效的管理员令牌');
    }

    const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } });
    if (!admin || admin.status === 0) {
      throw new UnauthorizedException('管理员不存在或已被禁用');
    }

    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      permissions: admin.permissions,
      type: 'admin',
    };
  }
}
