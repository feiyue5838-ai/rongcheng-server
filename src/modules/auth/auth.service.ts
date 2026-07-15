import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../wechat/wechat.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private wechatService: WechatService,
  ) {}

  // ==================== 小程序用户登录 ====================

  /**
   * 微信小程序登录
   * @param code 微信授权 code
   */
  async wxLogin(code: string) {
    // 1. 通过 code 获取 openid
    const openid = await this.wechatService.getOpenidByCode(code);
    if (!openid) {
      throw new BadRequestException('微信登录失败，无效的授权 code');
    }

    // 2. 查找或创建用户
    let user = await this.prisma.user.findUnique({ where: { openid } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { openid, status: 1 },
      });
    }

    // 3. 生成 Token
    const payload = { sub: user.id, openid, type: 'user' };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        realname: user.realname,
      },
    };
  }

  // ==================== 管理端登录 ====================

  /**
   * 管理员登录
   */
  async adminLogin(username: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (admin.status === 0) {
      throw new UnauthorizedException('账号已被禁用，请联系超级管理员');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 更新登录信息
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: '127.0.0.1', // TODO: 从请求中获取真实 IP
      },
    });

    // 生成 Token
    const payload = { sub: admin.id, username: admin.username, role: admin.role, type: 'admin' };
    const token = this.jwtService.sign(payload);

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role,
        permissions: admin.permissions,
      },
    };
  }

  // ==================== Token 验证 ====================

  /**
   * 验证 Token 并获取用户信息
   */
  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.type === 'user') {
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user || user.status === 0) return null;
        return { ...payload, user };
      } else if (payload.type === 'admin') {
        const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } });
        if (!admin || admin.status === 0) return null;
        return { ...payload, admin };
      }
      return null;
    } catch {
      return null;
    }
  }

  // ==================== 管理员密码管理 ====================

  /**
   * 创建超级管理员（首次部署时使用）
   */
  async createSuperAdmin(username: string, password: string) {
    const existing = await this.prisma.admin.findUnique({ where: { username } });
    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await this.prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        nickname: '超级管理员',
        role: 'superadmin',
        permissions: ['*'],
        status: 1,
      },
    });

    return { id: admin.id, username: admin.username };
  }

  // ==================== 门店登录 ====================

  /**
   * 门店登录
   */
  async storeLogin(phone: string, password: string) {
    const store = await this.prisma.store.findUnique({ where: { phone } });
    if (!store) {
      throw new NotFoundException('门店账号不存在');
    }

    if (store.status === 0) {
      throw new BadRequestException('账号已被禁用，请联系管理员');
    }

    const isMatch = await bcrypt.compare(password, store.password);
    if (!isMatch) {
      throw new UnauthorizedException('密码错误');
    }

    // 更新登录信息
    await this.prisma.store.update({
      where: { id: store.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.jwtService.sign({
      sub: store.id,
      phone: store.phone,
      name: store.name,
      type: 'store',
    });

    return {
      token,
      store: {
        id: store.id,
        name: store.name,
        contact: store.contact,
        phone: store.phone,
        province: store.province,
        city: store.city,
        address: store.address,
        status: store.status,
      },
    };
  }

  // ==================== 管理员信息 ====================
  async getAdminProfile(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, nickname: true, role: true, permissions: true, status: true, createdAt: true },
    });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }
    return admin;
  }
}
