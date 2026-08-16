import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class FinanceRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未登录');
    }

    if (user.type !== 'admin') {
      throw new ForbiddenException('仅管理员可访问');
    }

    if (user.role !== 'finance' && user.role !== 'superadmin') {
      throw new ForbiddenException('需要财务角色权限');
    }

    return true;
  }
}
