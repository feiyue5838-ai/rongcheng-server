// @ts-nocheck
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function snakeToCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toCamelDeep(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj instanceof Date) return obj;
  if (typeof obj === 'object') return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)]),
  );
  return obj;
}

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
    const list = await this.prisma.addresses.findMany({
      where: { user_id },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    });
    return list.map((a: any) => {
      const camel = toCamelDeep(a);
      camel.name = camel.contact; // 前端读 name，DB 字段是 contact
      return camel;
    });
  }

  /** 添加收货地址 */
  async addAddress(user_id: string, dto: any) {
    const data = this._normalizeAddressDto(dto);
    // 如果设为默认，先取消其他默认
    if (data.is_default) {
      await this.prisma.addresses.updateMany({
        where: { user_id },
        data: { is_default: false },
      });
    }
    return this.prisma.addresses.create({ data: { ...data, user_id } });
  }

  /** 更新收货地址 */
  async updateAddress(user_id: string, address_id: string, dto: any) {
    const data = this._normalizeAddressDto(dto);
    if (!Object.keys(data).length) throw new Error('无有效地址字段');
    if (data.is_default) {
      await this.prisma.addresses.updateMany({
        where: { user_id },
        data: { is_default: false },
      });
    }
    return this.prisma.addresses.update({ where: { id: address_id }, data });
  }

  /** 删除收货地址 */
  async deleteAddress(user_id: string, address_id: string) {
    return this.prisma.addresses.delete({ where: { id: address_id } });
  }

  /** 归一化前端地址 DTO：name→contact、isDefault→is_default、白名单过滤 */
  _normalizeAddressDto(dto: any) {
    const data: any = {};
    if (dto.name !== undefined) data.contact = dto.name;
    if (dto.contact !== undefined) data.contact = dto.contact;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.province !== undefined) data.province = dto.province;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.district !== undefined) data.district = dto.district;
    if (dto.detail !== undefined) data.detail = dto.detail;
    if (dto.is_default !== undefined) data.is_default = dto.is_default;
    if (dto.isDefault !== undefined) data.is_default = dto.isDefault;
    return data;
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
      list: toCamelDeep(users),
      pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    };
  }

  /** 管理端：更新用户（状态等） */
  async adminUpdateUser(id: string, dto: any) {
    const updateData: any = {};
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.realname !== undefined) updateData.realname = dto.realname;

    const user = await this.prisma.users.update({ where: { id }, data: updateData });
    return toCamelDeep(user);
  }

  /** 管理端：删除用户 */
  async adminDeleteUser(id: string) {
    await this.prisma.users.delete({ where: { id } });
    return { success: true };
  }
}
