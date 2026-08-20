import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class ProductAdminJwtAuthGuard extends AdminJwtAuthGuard {
  handleRequest(err: any, user: any, info: any) {
    const admin = super.handleRequest(err, user, info);
    if (!['superadmin', 'product_admin'].includes(admin.role)) {
      throw new ForbiddenException('权限不足，需要超级管理员或产品管理员权限');
    }
    return admin;
  }
}
