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
import { SettlementV2Service } from '../services/settlement.service';
import { AdminJwtAuthGuard } from '../../auth/guards/admin-jwt-auth.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';

@Controller('v2/admin')
@UseInterceptors(ResponseInterceptor)
export class AdminController {
  constructor(
    private readonly orderService: OrderV2Service,
    private readonly fulfillmentService: FulfillmentService,
    private readonly settlementService: SettlementV2Service,
  ) {}

  /**
   * 数据看板
   * GET /api/v2/admin/dashboard
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('dashboard')
  async getDashboard() {
    return this.orderService.getDashboardStats();
  }

  /**
   * 供应商列表（派单/改派选择用）
   * GET /api/v2/admin/suppliers?keyword=&page=&pageSize=
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('suppliers')
  async listSuppliers(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.fulfillmentService.listSuppliers({
      keyword,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
    });
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
    // 管理端订单全量列表
    return this.orderService.listOrders({
      orderStatus,
      module,
      keyword,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 待派单订单（静态路由，必须在 :orderNo 动态路由之前声明）
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
   * 订单详情（供应链视图）
   * GET /api/v2/admin/orders/:orderNo
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('orders/:orderNo')
  async getOrderDetail(@Param('orderNo') orderNo: string) {
    return this.orderService.getOrderDetail(orderNo);
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
    return this.fulfillmentService.assignOrder(orderNo, body.supplierId, req.user.id);
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
    return this.fulfillmentService.reassignOrder(orderNo, body.supplierId, req.user.id, body?.cancelRemark);
  }

  // ============ 结算（财务/运营） ============

  /**
   * 结算单列表
   * GET /api/v2/admin/settlements
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('settlements')
  async listSettlements(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.settlementService.listSettlements({
      status,
      supplierId,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 结算单详情
   * GET /api/v2/admin/settlements/:id
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('settlements/:id')
  async getSettlementDetail(@Param('id') id: string) {
    return this.settlementService.getSettlementDetail(id);
  }

  /**
   * 生成结算单
   * POST /api/v2/admin/settlements/generate
   */
  @UseGuards(AdminJwtAuthGuard)
  @Post('settlements/generate')
  async generateSettlement(@Request() req: any, @Body() body: { supplierId: string; periodStart: string; periodEnd: string }) {
    return this.settlementService.generateSettlement({
      supplierId: body.supplierId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      operatorId: req.user.id,
    });
  }

  /**
   * 确认结算单
   * PUT /api/v2/admin/settlements/:id/confirm
   */
  @UseGuards(AdminJwtAuthGuard)
  @Put('settlements/:id/confirm')
  async confirmSettlement(@Param('id') id: string, @Request() req: any, @Body() body: { remark?: string }) {
    return this.settlementService.confirmSettlement(id, req.user.id, body?.remark);
  }

  /**
   * 结算单付款（财务）
   * POST /api/v2/admin/settlements/:id/pay
   */
  @UseGuards(AdminJwtAuthGuard)
  @Post('settlements/:id/pay')
  async paySettlement(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.settlementService.paySettlement(id, {
      operatorId: req.user.id,
      paymentMethod: body?.paymentMethod,
      transactionNo: body?.transactionNo,
      bankName: body?.bankName,
      bankAccountName: body?.bankAccountName,
      bankAccountNo: body?.bankAccountNo,
    });
  }

  // ============ 退款审核 ============

  /**
   * 退款单列表
   * GET /api/v2/admin/refunds
   */
  @UseGuards(AdminJwtAuthGuard)
  @Get('refunds')
  async listRefunds(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orderService.listRefunds({
      status,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  /**
   * 审核通过退款
   * POST /api/v2/admin/refunds/:id/approve
   */
  @UseGuards(AdminJwtAuthGuard)
  @Post('refunds/:id/approve')
  async approveRefund(@Param('id') id: string, @Request() req: any, @Body() body?: any) {
    return this.orderService.reviewRefund(id, true, req.user.id, body?.remark);
  }

  /**
   * 驳回退款
   * POST /api/v2/admin/refunds/:id/reject
   */
  @UseGuards(AdminJwtAuthGuard)
  @Post('refunds/:id/reject')
  async rejectRefund(@Param('id') id: string, @Request() req: any, @Body() body?: any) {
    return this.orderService.reviewRefund(id, false, req.user.id, body?.remark);
  }
}
