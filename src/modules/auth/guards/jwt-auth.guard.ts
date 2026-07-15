import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('未登录或登录已过期');
    }
    if (user.type !== 'admin') {
      throw new UnauthorizedException('需要管理员权限');
    }
    return user;
  }
}
