// DDD 架构 - 订单控制器（新架构）
// 基于 OrderDDDService，提供 RESTful API

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrderDDDService } from './order.ddd.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('orders-ddd')
export class OrderDDDController {
  constructor(private readonly orderService: OrderDDDService) {}

  // ============ 用户端接口 ============

  /**
   * 获取我的订单列表
   * GET /api/orders-ddd/my
   */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyOrders(
    @Request() req: any,
    @Query('bizType') bizType?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.getMyOrders(req.user.userId, {
      bizType,
      status: status ? parseInt(status) : undefined,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 获取订单详情
   * GET /api/orders-ddd/:orderNo
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':orderNo')
  async getOrderDetail(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
  ) {
    const userId = req.user?.userId;
    return this.orderService.getOrderDetail(orderNo, userId);
  }

  /**
   * 创建刻章订单
   * POST /api/orders-ddd/seal
   */
  @UseGuards(JwtAuthGuard)
  @Post('seal')
  async createSealOrder(@Request() req: any, @Body() data: any) {
    const order = await this.orderService.createSealOrder(req.user.userId, data);
    return {
      code: 0,
      data: order,
      message: '订单创建成功',
    };
  }

  /**
   * 创建登报订单
   * POST /api/orders-ddd/newspaper
   */
  @UseGuards(JwtAuthGuard)
  @Post('newspaper')
  async createNewspaperOrder(@Request() req: any, @Body() data: any) {
    const order = await this.orderService.createNewspaperOrder(req.user.userId, data);
    return {
      code: 0,
      data: order,
      message: '订单创建成功',
    };
  }

  /**
   * 取消订单
   * POST /api/orders-ddd/:orderNo/cancel
   */
  @UseGuards(JwtAuthGuard)
  @Post(':orderNo/cancel')
  async cancelOrder(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
  ) {
    const result = await this.orderService.cancelOrder(orderNo, req.user.userId);
    return {
      code: 0,
      data: result,
      message: '订单已取消',
    };
  }

  /**
   * 确认收货
   * POST /api/orders-ddd/:orderNo/confirm
   */
  @UseGuards(JwtAuthGuard)
  @Post(':orderNo/confirm')
  async confirmReceive(
    @Param('orderNo') orderNo: string,
    @Request() req: any,
  ) {
    const result = await this.orderService.confirmReceive(orderNo, req.user.userId);
    return {
      code: 0,
      data: result,
      message: '已确认收货',
    };
  }

  // ============ 管理端接口 ============

  /**
   * 管理员查询订单列表
   * GET /api/orders-ddd/admin/list
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('admin/list')
  async adminGetOrders(
    @Query('bizType') bizType?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('orderNo') orderNo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.adminGetOrders({
      bizType,
      status: status ? parseInt(status) : undefined,
      userId,
      orderNo,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 获取统计数据
   * GET /api/orders-ddd/admin/statistics
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('admin/statistics')
  async getStatistics() {
    return this.orderService.getStatistics();
  }

  /**
   * 获取待派单订单
   * GET /api/orders-ddd/admin/unassigned
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('admin/unassigned')
  async getUnassignedOrders(
    @Query('bizType') bizType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.getUnassignedOrders({
      bizType,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 获取已派单订单
   * GET /api/orders-ddd/admin/assigned
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('admin/assigned')
  async getAssignedOrders(
    @Query('bizType') bizType?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.getAssignedOrders({
      bizType,
      status: status ? parseInt(status) : undefined,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 派单
   * POST /api/orders-ddd/admin/assign
   */
  @UseGuards(AdminJwtAuthGuard)
  @Post('admin/assign')
  async assignOrder(
    @Body() body: { orderNo: string; supplierId: string },
    @Request() req: any,
  ) {
    const result = await this.orderService.assignOrder(
      body.orderNo,
      body.supplierId,
      req.user.userId,
    );
    return {
      code: 0,
      data: result,
      message: '派单成功',
    };
  }

  // ============ 供应商端接口 ============

  /**
   * 供应商获取自己的订单
   * GET /api/orders-ddd/supplier/my
   */
  @UseGuards(JwtAuthGuard)
  @Get('supplier/my')
  async getSupplierOrders(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // TODO: 从 token 中获取 supplierId
    const supplierId = req.user.supplierId;
    return this.orderService.getSupplierOrders(supplierId, {
      status: status ? parseInt(status) : undefined,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 供应商接单
   * POST /api/orders-ddd/supplier/accept
   */
  @UseGuards(JwtAuthGuard)
  @Post('supplier/accept')
  async acceptOrder(
    @Body() body: { orderNo: string },
    @Request() req: any,
  ) {
    // TODO: 从 token 中获取 supplierId
    const supplierId = req.user.supplierId;
    const result = await this.orderService.acceptOrder(body.orderNo, supplierId);
    return {
      code: 0,
      data: result,
      message: '接单成功',
    };
  }

  /**
   * 供应商交付订单
   * POST /api/orders-ddd/supplier/deliver
   */
  @UseGuards(JwtAuthGuard)
  @Post('supplier/deliver')
  async deliverOrder(
    @Body() body: {
      orderNo: string;
      delivery_method?: string;
      express_company?: string;
      express_no?: string;
      remark?: string;
    },
    @Request() req: any,
  ) {
    // TODO: 从 token 中获取 supplierId
    const supplierId = req.user.supplierId;
    const result = await this.orderService.deliverOrder(
      body.orderNo,
      supplierId,
      body,
    );
    return {
      code: 0,
      data: result,
      message: '交付成功',
    };
  }
}
