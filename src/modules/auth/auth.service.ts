// @ts-nocheck
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../wechat/wechat.service';
import { JWT_SECRET, JWT_SECRET_ADMIN, JWT_SECRET_OUTLET } from '../../common/config/jwt.config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private wechatService: WechatService,
  ) {}

  // 供 Controller 判断是否需要鉴权
  async getAdminCount(): Promise<number> {
    return this.prisma.admins.count();
  }

  async createSuperAdmin(username: string, password: string, requireAuth = false) {
    if (!username || !password) {
      throw new BadRequestException('用户名和密码不能为空');
    }
    const adminCount = await this.prisma.admins.count();
    if (adminCount > 0 && requireAuth) {
      throw new UnauthorizedException('必须以管理员身份登录后创建超管');
    }
    const existing = await this.prisma.admins.findUnique({ where: { username } });
    if (existing) {
      throw new BadRequestException('用户名已存在');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await this.prisma.admins.create({
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
    let user = await this.prisma.users.findUnique({ where: { openid } });
    if (!user) {
      user = await this.prisma.users.create({
        data: { openid, status: 1 },
      });
    }

    // 3. 生成 Token（A-03: 使用用户专属密钥）
    const payload = { sub: user.id, openid, type: 'user' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

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
   * @param ip 管理员登录 IP（A-06: 审计字段不写死）
   */
  async adminLogin(username: string, password: string, ip: string = '127.0.0.1') {
    if (!username || !password) {
      throw new BadRequestException('用户名和密码不能为空');
    }
    const admin = await this.prisma.admins.findUnique({ where: { username } });
    if (!admin) {
      // A-05: 统一返回「用户名或密码错误」，防止账号枚举
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (admin.status === 0) {
      throw new UnauthorizedException('账号已被禁用，请联系超级管理员');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      // A-05: 统一返回「用户名或密码错误」，防止账号枚举
      throw new UnauthorizedException('用户名或密码错误');
    }

    // A-06: 使用真实登录 IP
    await this.prisma.admins.update({
      where: { id: admin.id },
      data: {
        last_login_at: new Date(),
        last_login_ip: ip,
      },
    });

    // 生成 Token（A-03: 使用管理员专属密钥）
    const payload = { sub: admin.id, username: admin.username, role: admin.role, type: 'admin' };
    const token = jwt.sign(payload, JWT_SECRET_ADMIN, { expiresIn: '30d' });

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
        const user = await this.prisma.users.findUnique({ where: { id: payload.sub } });
        if (!user || user.status === 0) return null;
        return { ...payload, user };
      } else if (payload.type === 'admin') {
        const admin = await this.prisma.admins.findUnique({ where: { id: payload.sub } });
        if (!admin || admin.status === 0) return null;
        return { ...payload, admin };
      }
      return null;
    } catch {
      return null;
    }
  }

  // ==================== 网点登录 ====================

  /**
   * 网点登录
   * A-05: 统一错误信息为「手机号或密码错误」，防止账号枚举
   */
  async storeLogin(phone: string, password: string) {
    if (!phone || !password) {
      throw new BadRequestException('手机号和密码不能为空');
    }
    const Outlet = await this.prisma.outlets.findUnique({
      where: { phone },
      include: {
        outlet_business_types: {
          include: { business_type: true },
        },
      },
    });
    if (!Outlet) {
      // A-05: 统一返回 401 + 统一文案，防止账号枚举
      throw new UnauthorizedException('手机号或密码错误');
    }

    if (Outlet.status === 0) {
      // A-05: 禁用账号也走统一 401（不再单独区分 400/403，防止枚举）
      throw new UnauthorizedException('手机号或密码错误');
    }

    const isMatch = await bcrypt.compare(password, Outlet.password);
    if (!isMatch) {
      // A-05: 统一返回 401 + 统一文案
      throw new UnauthorizedException('手机号或密码错误');
    }

    // 更新登录信息
    await this.prisma.outlets.update({
      where: { id: Outlet.id },
      data: { last_login_at: new Date() },
    });

    // A-03: 使用网点专属密钥
    const token = jwt.sign({
      sub: Outlet.id,
      phone: Outlet.phone,
      name: Outlet.name,
      type: 'Outlet',
    }, JWT_SECRET_OUTLET, { expiresIn: '30d' });

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
        outlet_openid: Outlet.outlet_openid || null,
        subscribe_msg: Outlet.subscribe_msg,
        businessTypes:
          Outlet.outlet_business_types?.map(t => ({
            id: t.business_type.id,
            name: t.business_type.name,
            code: t.business_type.code,
          })) ?? [],
      },
    };
  }

  // ==================== 管理员信息 ====================
  async getAdminProfile(admin_id: string) {
    const admin = await this.prisma.admins.findUnique({
      where: { id: admin_id },
      select: { id: true, username: true, nickname: true, role: true, permissions: true, status: true, created_at: true },
    });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }
    return admin;
  }
}
