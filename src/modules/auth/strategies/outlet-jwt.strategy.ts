import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JWT_SECRET_OUTLET } from '../../../common/config/jwt.config';

@Injectable()
export class StoreJwtStrategy extends PassportStrategy(Strategy, 'Outlet-jwt') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET_OUTLET,
    });
  }

  async validate(payload: any) {
    if (payload.type !== 'Outlet') {
      throw new UnauthorizedException('无效的网点令牌');
    }

    const Outlet = await this.prisma.outlets.findUnique({ where: { id: payload.sub } });
    if (!Outlet || Outlet.status === 0) {
      throw new UnauthorizedException('网点不存在或已被禁用');
    }

    return {
      id: Outlet.id,
      phone: Outlet.phone,
      name: Outlet.name,
      type: 'Outlet',
    };
  }
}
