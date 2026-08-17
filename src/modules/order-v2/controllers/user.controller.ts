// V2.0 用户端订单控制器
// 路由前缀: /api/v2/user

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { OrderV2Service } from '../services/order-v2.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';

@Controller('v2/user')
@UseInterceptors(ResponseInterceptor)
export class OrderV2Controller {
  constructor(private readonly orderService: OrderV2Service) {}

  // ============ 订单列表/详情 ============

  /**
   * 获取我的订单列表
   * GET /api/v2/user/orders
   */
  @UseGuards(JwtAuthGuard)
  @Get('orders')
  async getMyOrders(
    @Request() req: any,
    @Query('tab') tab?: string,
    @Query('module') module?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.getMyOrders(req.user.id, {
      tab,
      module,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 获取订单详情
   * GET /api/v2/user/orders/:orderNo
   */
  @UseGuards(JwtAuthGuard)
  @Get('orders/:orderNo')
  async getOrderDetail(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
  ) {
    return this.orderService.getOrderDetail(orderNo, req.user.id);
  }

  // ============ 创建订单 ============

  /**
   * 创建刻章订单
   * POST /api/v2/user/orders/seal
   */
  @UseGuards(JwtAuthGuard)
  @Post('orders/seal')
  async createSealOrder(@Request() req: any, @Body() data: any) {
    return this.orderService.createSealOrder(req.user.id, data);
  }

  /**
   * 创建登报订单
   * POST /api/v2/user/orders/newspaper
   */
  @UseGuards(JwtAuthGuard)
  @Post('orders/newspaper')
  async createNewspaperOrder(@Request() req: any, @Body() data: any) {
    return this.orderService.createNewspaperOrder(req.user.id, data);
  }

  /**
   * 创建记账订单
   * POST /api/v2/user/orders/bookkeeping
   */
  @UseGuards(JwtAuthGuard)
  @Post('orders/bookkeeping')
  async createBookkeepingOrder(@Request() req: any, @Body() data: any) {
    return this.orderService.createBookkeepingOrder(req.user.id, data);
  }

  // ============ 支付/取消/确认 ============

  /**
   * 获取支付参数
   * POST /api/v2/user/orders/:orderNo/pay
   */
  @UseGuards(JwtAuthGuard)
  @Post('orders/:orderNo/pay')
  async getPayParams(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
    @Body() body?: any,
  ) {
    return this.orderService.getPayParams(orderNo, req.user.id, body?.paymentMethod);
  }

  /**
   * 取消订单
   * POST /api/v2/user/orders/:orderNo/cancel
   */
  @UseGuards(JwtAuthGuard)
  @Post('orders/:orderNo/cancel')
  async cancelOrder(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
    @Body('reason') reason?: string,
  ) {
    return this.orderService.cancelOrder(orderNo, req.user.id, reason);
  }

  /**
   * 确认收货
   * POST /api/v2/user/orders/:orderNo/confirm
   */
  @UseGuards(JwtAuthGuard)
  @Post('orders/:orderNo/confirm')
  async confirmReceive(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
  ) {
    return this.orderService.confirmReceive(orderNo, req.user.id);
  }

  /**
   * 申请退款
   * POST /api/v2/user/orders/:orderNo/refund
   */
  @UseGuards(JwtAuthGuard)
  @Post('orders/:orderNo/refund')
  async applyRefund(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
    @Body() body?: any,
  ) {
    return this.orderService.applyRefund(orderNo, req.user.id, {
      refundType: body?.refundType,
      refundAmount: body?.refundAmount,
      reason: body?.reason,
    });
  }
}
