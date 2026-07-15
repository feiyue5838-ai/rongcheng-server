import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StoreJwtStrategy extends PassportStrategy(Strategy, 'store-jwt') {
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
    if (payload.type !== 'store') {
      throw new UnauthorizedException('无效的门店令牌');
    }

    const store = await this.prisma.store.findUnique({ where: { id: payload.sub } });
    if (!store || store.status === 0) {
      throw new UnauthorizedException('门店不存在或已被禁用');
    }

    return {
      id: store.id,
      phone: store.phone,
      name: store.name,
      type: 'store',
    };
  }
}
