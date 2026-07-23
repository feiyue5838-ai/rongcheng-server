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
    if (!code) {
      throw new BadRequestException('微信授权 code 不能为空');
    }
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
      openid,
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
    if (!username || !password) {
      throw new BadRequestException('用户名和密码不能为空');
    }
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
    if (!username || !password) {
      throw new BadRequestException('用户名和密码不能为空');
    }
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

  // ==================== 网点登录 ====================

  /**
   * 网点登录
   */
  async storeLogin(phone: string, password: string) {
    if (!phone || !password) {
      throw new BadRequestException('手机号和密码不能为空');
    }
    const Outlet = await this.prisma.outlet.findUnique({ where: { phone } });
    if (!Outlet) {
      throw new NotFoundException('网点账号不存在');
    }

    if (Outlet.status === 0) {
      throw new BadRequestException('账号已被禁用，请联系管理员');
    }

    const isMatch = await bcrypt.compare(password, Outlet.password);
    if (!isMatch) {
      throw new UnauthorizedException('密码错误');
    }

    // 更新登录信息
    await this.prisma.outlet.update({
      where: { id: Outlet.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.jwtService.sign({
      sub: Outlet.id,
      phone: Outlet.phone,
      name: Outlet.name,
      type: 'Outlet',
    });

    return {
      token,
      outlet: {
        id: Outlet.id,
        name: Outlet.name,
        contact: Outlet.contact,
        phone: Outlet.phone,
        province: Outlet.province,
        city: Outlet.city,
        address: Outlet.address,
        status: Outlet.status,
        outletOpenid: Outlet.outletOpenid || null,
        subscribeMsg: Outlet.subscribeMsg,
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
