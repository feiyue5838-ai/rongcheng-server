import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /** 获取当前用户信息 */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  /** 更新用户信息 */
  async updateProfile(userId: string, dto: any) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  /** 获取收货地址列表 */
  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** 添加收货地址 */
  async addAddress(userId: string, dto: any) {
    // 如果设为默认，先取消其他默认
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({ data: { ...dto, userId } });
  }

  /** 更新收货地址 */
  async updateAddress(userId: string, addressId: string, dto: any) {
    const address = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('地址不存在');

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({ where: { id: addressId }, data: dto });
  }

  /** 删除收货地址 */
  async deleteAddress(userId: string, addressId: string) {
    return this.prisma.address.delete({ where: { id: addressId } });
  }

  /** 获取发票列表 */
  async getInvoices(userId: string) {
    return this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 添加发票 */
  async addInvoice(userId: string, dto: any) {
    return this.prisma.invoice.create({ data: { ...dto, userId } });
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
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      list: users,
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }
}
