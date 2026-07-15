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
      // 1) 验签 + 解密（生产必做，见 WechatService.handlePayNotify 内 TODO）
      const result = await this.wechatService.handlePayNotify(body, headers);
      if (!result || !result.orderNo) {
        return { code: 'FAIL', message: '订单号缺失' };
      }
      // 2) 统一入口：置『已支付』并触发网点自动分配（幂等，可重复回调）
      await this.orderService.completePayment(
        { orderNo: result.orderNo },
        { payMethod: 'wechat', transactionId: result.transactionId },
      );
      return { code: 'SUCCESS', message: '处理成功' };
    } catch (error) {
      console.error('微信支付回调处理失败:', error);
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
