// V2.0 支付域控制器
// 路由前缀: /api/v2/payments（微信服务器回调，免鉴权）

import { Controller, Post, Body, UseInterceptors } from '@nestjs/common';
import { OrderV2Service } from '../services/order-v2.service';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';

@Controller('v2/payments')
@UseInterceptors(ResponseInterceptor)
export class PaymentsV2Controller {
  constructor(private readonly orderService: OrderV2Service) {}

  /**
   * 微信支付成功回调
   * POST /api/v2/payments/wechat/notify
   */
  @Post('wechat/notify')
  async wechatNotify(@Body() payload: any) {
    const result = await this.orderService.notifyPayment(payload);
    // 微信要求：处理成功返回 SUCCESS
    if (result.success) {
      return { code: 0, message: 'SUCCESS', data: result };
    }
    return { code: 2003, message: result.message || 'FAIL', data: result };
  }

  /**
   * 微信退款回调
   * POST /api/v2/payments/wechat/refund-notify
   */
  @Post('wechat/refund-notify')
  async wechatRefundNotify(@Body() payload: any) {
    const result = await this.orderService.notifyRefund(payload);
    if (result.success) {
      return { code: 0, message: 'SUCCESS', data: result };
    }
    return { code: 2004, message: result.message || 'FAIL', data: result };
  }
}
