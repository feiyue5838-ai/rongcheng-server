import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateAdmin(username: string, password: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (admin.status === 0) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return admin;
  }

  async login(username: string, password: string) {
    const admin = await this.validateAdmin(username, password);
    
    const payload = {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      type: 'admin',
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role,
      },
    };
  }

  async initAdmin(username: string, password: string) {
    // 检查是否已有管理员
    const count = await this.prisma.admin.count();
    if (count > 0) {
      throw new BadRequestException('超级管理员已存在，无法重复初始化');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await this.prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        nickname: '超级管理员',
        role: 'superadmin',
        permissions: ['*'],
      },
    });

    return {
      id: admin.id,
      username: admin.username,
      nickname: admin.nickname,
      role: admin.role,
    };
  }
}
