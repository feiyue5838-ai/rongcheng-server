// @ts-nocheck
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../wechat/wechat.service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toCamelDeep(obj: any): any {
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj !== null && typeof obj === 'object') {
    if (typeof obj.toString === 'function' && !('getTime' in obj)) {
      const str = obj.toString();
      if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)])
    );
  }
  return obj;
}

interface PriceParams {
  taxpayer_type: 'small' | 'general';
  cycle: 'year' | 'half' | 'preorder';
  invoice: 'none' | 'within5' | 'normal';
  social: 'none' | 'with';
  fund: 'none' | 'with';
}

interface OrderParams extends PriceParams {
  phone: string;
  price: string | number;
}

@Injectable()
export class BookkeepingService {
  constructor(
    private prisma: PrismaService,
    private wechatService: WechatService,
  ) {}

  // ==================== 套餐管理 ====================

  /**
   * 获取套餐列表
   */
  async getPackageList(params: { taxpayer_type?: string; status?: number }) {
    const where: any = {};
    if (params.taxpayer_type) where.taxpayer_type = params.taxpayer_type;
    if (params.status !== undefined) where.status = params.status;

    const packages = await this.prisma.bookkeeping_packages.findMany({
      where,
      orderBy: [{ sort: 'asc' }, { created_at: 'desc' }],
    });

    return packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      taxpayerType: pkg.taxpayer_type,
      cycle: pkg.cycle,
      basePrice: Number(pkg.base_price),
      invoicePrice: Number(pkg.invoice_price),
      invoicePriceNormal: Number(pkg.invoice_price_normal),
      socialPrice: Number(pkg.social_price),
      fundPrice: Number(pkg.fund_price),
      sort: pkg.sort,
      status: pkg.status,
      createdAt: pkg.created_at,
    }));
  }

  /**
   * 获取套餐详情
   */
  async getPackageDetail(id: string) {
    const pkg = await this.prisma.bookkeeping_packages.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('套餐不存在');
    return {
      ...pkg,
      base_price: Number(pkg.base_price),
      invoice_price: Number(pkg.invoice_price),
      social_price: Number(pkg.social_price),
      fund_price: Number(pkg.fund_price),
    };
  }

  /**
   * 创建套餐
   */
  async createPackage(data: any) {
    const pkg = await this.prisma.bookkeeping_packages.create({
      data: {
        name: data.name,
        taxpayer_type: data.taxpayer_type,
        cycle: data.cycle,
        base_price: data.base_price,
        invoice_price: data.invoice_price || 0,
        social_price: data.social_price || 0,
        fund_price: data.fund_price || 0,
        description: data.description,
        features: data.features,
        sort: data.sort || 0,
        status: data.status ?? 1,
      },
    });
    return this.getPackageDetail(pkg.id);
  }

  /**
   * 更新套餐
   */
  async updatePackage(id: string, data: any) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.base_price !== undefined) updateData.base_price = data.base_price;
    if (data.invoice_price !== undefined) updateData.invoice_price = data.invoice_price;
    if (data.social_price !== undefined) updateData.social_price = data.social_price;
    if (data.fund_price !== undefined) updateData.fund_price = data.fund_price;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.features !== undefined) updateData.features = data.features;
    if (data.sort !== undefined) updateData.sort = data.sort;
    if (data.status !== undefined) updateData.status = data.status;

    await this.prisma.bookkeeping_packages.update({ where: { id }, data: updateData });
    return this.getPackageDetail(id);
  }

  /**
   * 删除套餐
   */
  async deletePackage(id: string) {
    await this.prisma.bookkeeping_packages.delete({ where: { id } });
    return { success: true };
  }

  // ==================== 价格计算 ====================

  /**
   * 计算代理记账价格
   */
  async calculatePriceFromDb(params: PriceParams): Promise<number> {
    // 从数据库读取套餐基础价格
    const pkg = await this.prisma.bookkeeping_packages.findFirst({
      where: {
        taxpayer_type: params.taxpayer_type,
        cycle: params.cycle,
        status: 1,
      },
      orderBy: { sort: 'asc' },
    });

    if (!pkg) {
      // 兜底：无匹配套餐时使用硬编码
      return this.calculatePriceFallback(params);
    }

    let total = Number(pkg.base_price);

    // 开票附加
    if (params.invoice === 'within5') {
      total += Number(pkg.invoice_price) || 0;
    } else if (params.invoice === 'normal') {
      // 正常开票：使用 invoice_price_normal 字段
      total += Number(pkg.invoice_price_normal) || 0;
    }

    // 社保附加
    if (params.social === 'with') {
      total += Number(pkg.social_price) || 300;
    }

    // 公积金附加（仅一般纳税人）
    if (params.taxpayer_type === 'general' && params.fund === 'with') {
      total += Number(pkg.fund_price) || 300;
    }

    return Number(total.toFixed(2));
  }

  /**
   * 硬编码兜底价格（数据库无套餐时使用）
   */
  calculatePriceFallback(params: PriceParams): number {
    let base = 0;
    if (params.taxpayer_type === 'small') {
      base = params.cycle === 'year' ? 1999 : params.cycle === 'half' ? 1199 : 1999;
    } else {
      base = params.cycle === 'year' ? 3999 : params.cycle === 'half' ? 2299 : 9.9;
    }

    let invoiceFee = 0;
    if (params.invoice === 'within5') invoiceFee = 200;
    else if (params.invoice === 'normal') invoiceFee = 500;

    let socialFee = params.social === 'with' ? 300 : 0;

    let fundFee = 0;
    if (params.taxpayer_type === 'general' && params.fund === 'with') {
      fundFee = 300;
    }

    const total = base + invoiceFee + socialFee + fundFee;
    return Number(total.toFixed(2));
  }

  /**
   * 计算代理记账价格（同步版本，保留兼容）
   */
  calculatePrice(params: PriceParams): number {
    return this.calculatePriceFallback(params);
  }

  /**
   * 获取价格
   */
  async getPrice(params: PriceParams): Promise<{ price: number }> {
    const price = await this.calculatePriceFromDb(params);
    return { price };
  }

  // ==================== 订单管理 ====================

  /**
   * 创建代理记账订单
   */
  async createOrder(params: OrderParams, user_id: string): Promise<any> {
    const calculatedPrice = await this.calculatePriceFromDb(params);
    const price = Number(params.price);

    if (Math.abs(price - calculatedPrice) > 0.02) {
      throw new BadRequestException(`价格不匹配：前端传入 ${price}，计算结果 ${calculatedPrice}`);
    }

    if (!user_id) {
      throw new BadRequestException('用户未登录');
    }

    const order_no = 'RCBK' + Date.now() + uuidv4().slice(0, 4).toUpperCase();

    const order = await this.prisma.seal_orders.create({
      data: {
        order_no,
        user_id,
        module: 'bookkeeping',
        type: '代理记账',
        total_price: price,
        pay_price: price,
        status: 1,
        status_text: '待支付',
        remark: JSON.stringify({
          taxpayer_type: params.taxpayer_type,
          cycle: params.cycle,
          invoice: params.invoice,
          social: params.social,
          fund: params.fund,
          phone: params.phone,
        }),
      },
    });

    return {
      id: order.id,
      order_no: order.order_no,
      total_price: order.total_price,
      status: order.status,
    };
  }

  /**
   * 获取代理记账订单支付参数
   */
  async getPayParams(order_id: string, user_id: string, openid?: string): Promise<any> {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: order_id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.module !== 'bookkeeping') throw new BadRequestException('非代理记账订单');
    if (order.user_id !== user_id) throw new BadRequestException('无权访问此订单');

    if (order.status !== 1) {
      return {
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: crypto.randomBytes(16).toString('hex'),
        package: 'prepay_id=mock_prepay_id',
        signType: 'MD5',
        paySign: 'mock_pay_sign',
      };
    }

    let userOpenid = openid;
    if (!userOpenid) {
      const user = await this.prisma.users.findUnique({ where: { id: user_id } });
      userOpenid = user?.openid || '';
    }

    const payResult = await this.wechatService.createUnifiedOrder({
      outTradeNo: order.order_no,
      totalFee: Math.round(Number(order.total_price) * 100),
      body: `蓉城企服-代理记账(${order.order_no})`,
      openid: userOpenid || '',
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || 'https://your-domain.com/api/wechat/pay-notify',
    });

    return {
      ...payResult,
      order_id: order.id,
    };
  }

  // ==================== 管理端订单列表 ====================

  /** 代理记账订单列表（管理端） */
  async getOrders(params: { page: number; pageSize: number; status?: number }) {
    const { page, pageSize, status } = params;
    const where: any = { module: 'bookkeeping' };
    if (status !== undefined) where.status = status;

    const [rows, total] = await Promise.all([
      this.prisma.seal_orders.findMany({
        where,
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.seal_orders.count({ where }),
    ]);

    // 解析 remark 里的参数
    const list = rows.map(o => {
      let extra: any = {};
      try { extra = JSON.parse(o.remark || '{}'); } catch { /* ignore */ }
      return {
        ...toCamelDeep(o),
        extra,
        totalPrice: Number(o.total_price) || 0,
        payPrice: Number(o.pay_price) || 0,
        createdAt: o.created_at,
        orderNo: o.order_no,
        contactPhone: o.contact_phone,
        statusText: o.status_text,
      };
    });

    return { rows: list, total, page, pageSize };
  }
}
