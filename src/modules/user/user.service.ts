// @ts-nocheck
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /** 获取当前用户信息 */
  async getProfile(user_id: string) {
    const user = await this.prisma.users.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  /** 更新用户信息 */
  async updateProfile(user_id: string, dto: any) {
    return this.prisma.users.update({ where: { id: user_id }, data: dto });
  }

  /** 获取收货地址列表 */
  async getAddresses(user_id: string) {
    return this.prisma.addresses.findMany({
      where: { user_id },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    });
  }

  /** 添加收货地址 */
  async addAddress(user_id: string, dto: any) {
    // 如果设为默认，先取消其他默认
    if (dto.is_default) {
      await this.prisma.addresses.updateMany({
        where: { user_id },
        data: { is_default: false },
      });
    }
    return this.prisma.addresses.create({ data: { ...dto, user_id } });
  }

  /** 更新收货地址 */
  async updateAddress(user_id: string, address_id: string, dto: any) {
    const address = await this.prisma.addresses.findFirst({ where: { id: address_id, user_id } });
    if (!address) throw new NotFoundException('地址不存在');

    if (dto.is_default) {
      await this.prisma.addresses.updateMany({
        where: { user_id },
        data: { is_default: false },
      });
    }

    return this.prisma.addresses.update({ where: { id: address_id }, data: dto });
  }

  /** 删除收货地址 */
  async deleteAddress(user_id: string, address_id: string) {
    return this.prisma.addresses.delete({ where: { id: address_id } });
  }

  /** 获取发票列表 */
  async getInvoices(user_id: string) {
    return this.prisma.invoices.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
    });
  }

  /** 添加发票 */
  async addInvoice(user_id: string, dto: any) {
    return this.prisma.invoices.create({ data: { ...dto, user_id } });
  }

  /** 管理端：用户列表 */
  async adminGetUsers(query: any) {
    const { page = 1, pageSize = 20, keyword } = query;
    const where: any = {};
    if (keyword) {
      where.OR = [
        { nickname: { contains: keyword } },
        { phone: { contains: keyword } },
        { realname: { contains: keyword } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.users.count({ where }),
    ]);

    return {
      list: users,
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }
}
