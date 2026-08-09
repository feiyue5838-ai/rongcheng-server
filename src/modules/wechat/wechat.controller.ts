import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WechatService } from './wechat.service';
import { OrderService } from '../order/order.service';

@ApiTags('微信支付回调')
@Controller('wechat')
export class WechatController {
  constructor(
    private readonly wechatService: WechatService,
    private readonly orderService: OrderService,
  ) {}

  @Post('pay-notify')
  @ApiOperation({ summary: '微信支付结果通知回调' })
  async handlePayNotify(@Body() body: any, @Headers() headers: any) {
    try {
      // V3：SHA256-RSA 签名验签（platform cert）+ AES-256-GCM 解密 + trade_state
      // V2：有 mchKey 时 MD5 摘要校验
      // 开发模式（无密钥）：直接信任回调
      const result = await this.wechatService.handlePayNotify(body, headers);
      if (!result || !result.order_no) {
        return { code: 'FAIL', message: '订单号缺失或验签失败' };
      }
      // 置『已支付』并触发网点自动分配（幂等，可重复回调）
      await this.orderService.completePayment(
        { order_no: result.order_no },
        { pay_method: 'wechat', transaction_id: result.transaction_id },
      );
      return { code: 'SUCCESS', message: '处理成功' };
    } catch (error) {
      console.error('微信支付回调处理失败:', error);
      return { code: 'FAIL', message: '处理失败' };
    }
  }

  @Post('refund-notify')
  @ApiOperation({ summary: '微信退款结果通知回调' })
  async handleRefundNotify(@Body() body: any, @Headers() headers: any) {
    try {
      // plaintext 模式（开发/测试）：直接传明文，绕开 AES 解密
      // 生产模式：body 包含 resource { ciphertext, nonce, associated_data }，由 handleRefundNotify 内部解密
      const result = await this.wechatService.handleRefundNotify(body);
      if (!result) {
        return { code: 'FAIL', message: '处理失败' };
      }
      return { code: 'SUCCESS', message: '处理成功' };
    } catch (error) {
      console.error('微信退款回调处理失败:', error);
      return { code: 'FAIL', message: '处理失败' };
    }
  }

  @Post('phone-login')
  @ApiOperation({ summary: '微信手机号一键登录' })
  async phoneLogin(@Body() body: { code: string }) {
    const phone = await this.wechatService.getPhoneNumber(body.code);
    if (!phone) throw new Error('获取手机号失败');
    return { phone };
  }
}
