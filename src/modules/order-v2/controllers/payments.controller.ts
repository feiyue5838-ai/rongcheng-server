// V2.0 支付域控制器
// 路由前缀: /api/v2/payments（微信服务器回调，免鉴权）
// 注意：微信回调要求响应体为明文 SUCCESS/FAIL（HTTP 200），
// 不能走统一 JSON 包装，故用 @Res() 直接写响应，绕过 ResponseInterceptor 返回值包装。

import { Controller, Post, Body, UseInterceptors, Res } from '@nestjs/common';
import { Response } from 'express';
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
  async wechatNotify(@Body() payload: any, @Res() res: Response) {
    const result = await this.orderService.notifyPayment(payload);
    if (result.success) {
      res.status(200).type('text/plain').send('SUCCESS');
      return;
    }
    res.status(200).type('text/plain').send('FAIL');
  }

  /**
   * 微信退款回调
   * POST /api/v2/payments/wechat/refund-notify
   */
  @Post('wechat/refund-notify')
  async wechatRefundNotify(@Body() payload: any, @Res() res: Response) {
    const result = await this.orderService.notifyRefund(payload);
    if (result.success) {
      res.status(200).type('text/plain').send('SUCCESS');
      return;
    }
    res.status(200).type('text/plain').send('FAIL');
  }
}
