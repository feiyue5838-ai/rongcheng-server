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

  /**
   * 计算代理记账价格
   * 定价规则（从 WXML 分析）：
   * - 小规模纳税人：全年 1999，半年 1199
   * - 一般纳税人：全年 3999，半年 2299，9.9 预定
   * - 开票附加：不开票 +0，5张内 +200，正常开票 +500
   * - 社保附加：不缴 +0，缴 +300
   * - 公积金附加（仅一般纳税人）：不开户 +0，开户 +300
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
   * 获取价格（返回给前端展示）
   */
  async getPrice(params: PriceParams): Promise<{ price: number }> {
    return { price: this.calculatePrice(params) };
  }

  /**
   * 创建代理记账订单
   */
  async createOrder(params: OrderParams, userId: string): Promise<any> {
    const calculatedPrice = this.calculatePrice(params);
    const price = Number(params.price);

    // 允许前端传入价格与计算价格有±0.01误差（浮点精度问题）
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
        // 存附加选项到 remark 字段
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

    // 未支付订单才需要拉起支付
    if (order.status !== 1) {
      return {
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: crypto.randomBytes(16).toString('hex'),
        package: 'prepay_id=mock_prepay_id',
        signType: 'MD5',
        paySign: 'mock_pay_sign',
      };
    }

    if (!openid) {
      // 从 user 表查 openid
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      openid = user?.openid || '';
    }

    const payResult = await this.wechatService.createUnifiedOrder({
      outTradeNo: order.orderNo,
      totalFee: Math.round(Number(order.totalPrice) * 100),
      body: `蓉城企服-代理记账(${order.orderNo})`,
      openid: openid || '',
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || 'https://your-domain.com/api/wechat/pay-notify',
    });

    return {
      ...payResult,
      orderId: order.id,
    };
  }
}
