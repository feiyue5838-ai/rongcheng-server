// V2.0 供应商端控制器
// 路由前缀: /api/v2/supplier

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
import { FulfillmentService } from '../services/fulfillment.service';
import { SupplierJwtAuthGuard } from '../../../common/guards/supplier-jwt.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';

@Controller('v2/supplier')
@UseInterceptors(ResponseInterceptor)
export class SupplierController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  /**
   * 获取待接单/进行中订单
   * GET /api/v2/supplier/orders
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Get('orders')
  async getMyOrders(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // TODO: 实现供应商订单列表
    return { list: [], total: 0, page: 1, pageSize: 20 };
  }

  /**
   * 接单
   * POST /api/v2/supplier/orders/:fulfillmentId/accept
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/accept')
  async acceptOrder(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
  ) {
    return this.fulfillmentService.acceptOrder(fulfillmentId, req.user.supplierId);
  }

  /**
   * 拒单
   * POST /api/v2/supplier/orders/:fulfillmentId/reject
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/reject')
  async rejectOrder(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
    @Body('reason') reason: string,
  ) {
    return this.fulfillmentService.rejectOrder(fulfillmentId, req.user.supplierId, reason);
  }

  /**
   * 开始制作
   * POST /api/v2/supplier/orders/:fulfillmentId/start
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/start')
  async startProduction(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
  ) {
    // TODO: 实现开始制作逻辑
    return { success: true };
  }

  /**
   * 发货
   * POST /api/v2/supplier/orders/:fulfillmentId/deliver
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/deliver')
  async deliverOrder(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
    @Body() body: { courier?: string; trackingNo?: string },
  ) {
    // TODO: 实现发货逻辑
    return { success: true };
  }

  /**
   * 完成履约
   * POST /api/v2/supplier/orders/:fulfillmentId/complete
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/complete')
  async completeOrder(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
  ) {
    // TODO: 实现完成逻辑
    return { success: true };
  }
}
