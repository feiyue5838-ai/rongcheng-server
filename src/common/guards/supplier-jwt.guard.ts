import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { JWT_SECRET_OUTLET } from '../config/jwt.config';

@Injectable()
export class SupplierJwtAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('未提供认证令牌');
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET_OUTLET) as { sub: string; type: string };

      if (payload.type !== 'outlet' && payload.type !== 'supplier') {
        throw new ForbiddenException('令牌类型不正确');
      }

      // 校验供应商状态
      const supplier = await this.prisma.suppliers.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true },
      });

      if (!supplier) {
        throw new UnauthorizedException('供应商不存在');
      }

      if (supplier.status !== 1) {
        throw new ForbiddenException('供应商已禁用或待审核');
      }

      request.user = {
        supplierId: supplier.id,
        type: 'supplier',
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('令牌无效或已过期');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) return undefined;
    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return undefined;
    return parts[1];
  }
}
