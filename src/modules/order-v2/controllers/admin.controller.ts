// V2.0 管理端控制器
// 路由前缀: /api/v2/admin

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { OrderV2Service } from '../services/order-v2.service';
import { FulfillmentService } from '../services/fulfillment.service';
import { AdminJwtAuthGuard } from '../../auth/guards/admin-jwt-auth.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';

@Controller('v2/admin')
@UseInterceptors(ResponseInterceptor)
export class AdminController {
  constructor(
    private readonly orderService: OrderV2Service,
    private readonly fulfillmentService: FulfillmentService,
  ) {}

  /**
   * 数据看板
   * GET /api/v2/admin/dashboard
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('dashboard')
  async getDashboard() {
    // TODO: 实现看板数据
    return { totalOrders: 0, gmv: '0.00', pendingAssign: 0, refunding: 0 };
  }

  /**
   * 订单列表（全量筛选）
   * GET /api/v2/admin/orders
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('orders')
  async getOrders(
    @Query('orderStatus') orderStatus?: string,
    @Query('module') module?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // TODO: 实现管理端订单列表
    return { list: [], total: 0, page: 1, pageSize: 20 };
  }

  /**
   * 订单详情（供应链视图）
   * GET /api/v2/admin/orders/:orderNo
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('orders/:orderNo')
  async getOrderDetail(@Param('orderNo') orderNo: string) {
    return this.orderService.getOrderDetail(orderNo);
  }

  /**
   * 待派单订单
   * GET /api/v2/admin/orders/unassigned
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('orders/unassigned')
  async getUnassignedOrders(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.fulfillmentService.getUnassignedOrders({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 派单
   * POST /api/v2/admin/orders/:orderNo/assign
   */
  @UseGuards(AdminJwtAuthGuard)
  @Post('orders/:orderNo/assign')
  async assignOrder(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
    @Body() body: { supplierId: string },
  ) {
    return this.fulfillmentService.assignOrder(orderNo, body.supplierId, req.user.adminId);
  }

  /**
   * 改派
   * POST /api/v2/admin/orders/:orderNo/reassign
   */
  @UseGuards(AdminJwtAuthGuard)
  @Post('orders/:orderNo/reassign')
  async reassignOrder(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
    @Body() body: { supplierId: string; cancelRemark?: string },
  ) {
    // TODO: 实现改派逻辑（多次派单链）
    return { success: true };
  }
}
