// @ts-nocheck
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
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
    // JwtAuthGuard 只接受用户令牌，管理员请使用 AdminJwtAuthGuard
    if (payload.type === 'admin') {
      throw new UnauthorizedException('此接口不允许管理员访问，请使用管理员账号登录管理后台');
    }

    if (payload.type !== 'user') {
      throw new UnauthorizedException('无效的访问令牌');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 0) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }
    return { id: user.id, openid: payload.openid, type: 'user', user };
  }
}
