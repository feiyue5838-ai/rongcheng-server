import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../wechat/wechat.service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

interface PriceParams {
  taxpayerType: 'small' | 'general';
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
  async getPackageList(params: { taxpayerType?: string; status?: number }) {
    const where: any = {};
    if (params.taxpayerType) where.taxpayerType = params.taxpayerType;
    if (params.status !== undefined) where.status = params.status;

    const packages = await this.prisma.bookkeepingPackage.findMany({
      where,
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    });

    return packages.map(pkg => ({
      ...pkg,
      basePrice: Number(pkg.basePrice),
      invoicePrice: Number(pkg.invoicePrice),
      socialPrice: Number(pkg.socialPrice),
      fundPrice: Number(pkg.fundPrice),
    }));
  }

  /**
   * 获取套餐详情
   */
  async getPackageDetail(id: string) {
    const pkg = await this.prisma.bookkeepingPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('套餐不存在');
    return {
      ...pkg,
      basePrice: Number(pkg.basePrice),
      invoicePrice: Number(pkg.invoicePrice),
      socialPrice: Number(pkg.socialPrice),
      fundPrice: Number(pkg.fundPrice),
    };
  }

  /**
   * 创建套餐
   */
  async createPackage(data: any) {
    const pkg = await this.prisma.bookkeepingPackage.create({
      data: {
        name: data.name,
        taxpayerType: data.taxpayerType,
        cycle: data.cycle,
        basePrice: data.basePrice,
        invoicePrice: data.invoicePrice || 0,
        socialPrice: data.socialPrice || 0,
        fundPrice: data.fundPrice || 0,
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
    if (data.basePrice !== undefined) updateData.basePrice = data.basePrice;
    if (data.invoicePrice !== undefined) updateData.invoicePrice = data.invoicePrice;
    if (data.socialPrice !== undefined) updateData.socialPrice = data.socialPrice;
    if (data.fundPrice !== undefined) updateData.fundPrice = data.fundPrice;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.features !== undefined) updateData.features = data.features;
    if (data.sort !== undefined) updateData.sort = data.sort;
    if (data.status !== undefined) updateData.status = data.status;

    await this.prisma.bookkeepingPackage.update({ where: { id }, data: updateData });
    return this.getPackageDetail(id);
  }

  /**
   * 删除套餐
   */
  async deletePackage(id: string) {
    await this.prisma.bookkeepingPackage.delete({ where: { id } });
    return { success: true };
  }

  // ==================== 价格计算 ====================

  /**
   * 计算代理记账价格
   */
  calculatePrice(params: PriceParams): number {
    let base = 0;
    if (params.taxpayerType === 'small') {
      base = params.cycle === 'year' ? 1999 : params.cycle === 'half' ? 1199 : 1999;
    } else {
      base = params.cycle === 'year' ? 3999 : params.cycle === 'half' ? 2299 : 9.9;
    }

    let invoiceFee = 0;
    if (params.invoice === 'within5') invoiceFee = 200;
    else if (params.invoice === 'normal') invoiceFee = 500;

    let socialFee = params.social === 'with' ? 300 : 0;

    let fundFee = 0;
    if (params.taxpayerType === 'general' && params.fund === 'with') {
      fundFee = 300;
    }

    const total = base + invoiceFee + socialFee + fundFee;
    return Number(total.toFixed(2));
  }

  /**
   * 获取价格
   */
  async getPrice(params: PriceParams): Promise<{ price: number }> {
    return { price: this.calculatePrice(params) };
  }

  // ==================== 订单管理 ====================

  /**
   * 创建代理记账订单
   */
  async createOrder(params: OrderParams, userId: string): Promise<any> {
    const calculatedPrice = this.calculatePrice(params);
    const price = Number(params.price);

    if (Math.abs(price - calculatedPrice) > 0.02) {
      throw new BadRequestException(`价格不匹配：前端传入 ${price}，计算结果 ${calculatedPrice}`);
    }

    if (!userId) {
      throw new BadRequestException('用户未登录');
    }

    const orderNo = 'RCBK' + Date.now() + uuidv4().slice(0, 4).toUpperCase();

    const order = await this.prisma.sealOrder.create({
      data: {
        orderNo,
        userId,
        module: 'bookkeeping',
        type: '代理记账',
        totalPrice: price,
        status: 1,
        statusText: '待支付',
        remark: JSON.stringify({
          taxpayerType: params.taxpayerType,
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
      orderNo: order.orderNo,
      totalPrice: order.totalPrice,
      status: order.status,
    };
  }

  /**
   * 获取代理记账订单支付参数
   */
  async getPayParams(orderId: string, userId: string, openid?: string): Promise<any> {
    const order = await this.prisma.sealOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.module !== 'bookkeeping') throw new BadRequestException('非代理记账订单');
    if (order.userId !== userId) throw new BadRequestException('无权访问此订单');

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
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      userOpenid = user?.openid || '';
    }

    const payResult = await this.wechatService.createUnifiedOrder({
      outTradeNo: order.orderNo,
      totalFee: Math.round(Number(order.totalPrice) * 100),
      body: `蓉城企服-代理记账(${order.orderNo})`,
      openid: userOpenid || '',
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || 'https://your-domain.com/api/wechat/pay-notify',
    });

    return {
      ...payResult,
      orderId: order.id,
    };
  }
}
