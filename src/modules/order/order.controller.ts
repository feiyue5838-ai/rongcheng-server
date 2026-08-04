import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { JwtAuthGuard, AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreJwtAuthGuard } from '../auth/guards/Outlet-jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('订单')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // ==================== 用户端接口 ====================

  @Post('seal')
  @Log("订单", "seal", "seal")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建刻章订单' })
  async createSealOrder(@Request() req, @Body() dto: any) {
    // req.user.id 来自 User 表；如无效则 fallback 到匿名用户
    const user_id = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.orderService.createSealOrder(user_id, dto);
  }

  @Post('newspaper')
  @Log("订单", "newspaper", "newspaper")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建登报订单' })
  async createNewspaperOrder(@Request() req, @Body() dto: any) {
    const user_id = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.orderService.createNewspaperOrder(user_id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的订单列表' })
  async getMyOrders(@Request() req, @Query() query: any) {
    return this.orderService.getMyOrders(req.user.id, query);
  }

  // ==================== 管理端接口 ====================
  // ⚠️ 顺序敏感：硬编码路径必须在 @Get(':id') 之前

  @Get('admin/detail/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：订单详情' })
  async adminGetOrderDetail(@Param('id') id: string) {
    return this.orderService.getOrderDetail(id);
  }

  @Get('unassigned')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '待分配订单列表' })
  async getUnassignedOrders(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('module') module?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.orderService.getUnassignedOrders({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      module,
      keyword,
    });
  }

  @Get('assigned')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '已分配订单列表' })
  async getAssignedOrders(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('module') module?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.orderService.getAssignedOrders({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      module,
      keyword,
    });
  }

  @Get('admin/list')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：订单列表' })
  async adminGetOrders(@Query() query: any) {
    return this.orderService.adminGetOrders(query);
  }

  @Put('admin/:id')
  @Log("订单", "更新订单", "admin/:id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：更新订单（状态、物流等）' })
  async adminUpdateOrder(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.orderService.adminUpdateOrder(id, dto, req.user.id);
  }

  @Put('admin/materials/:id/audit')
  @Log("订单", "材料", "admin/materials/:id/audit")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：审核材料（通过/驳回）' })
  async auditMaterial(@Param('id') id: string, @Body() body: { status: number; remark?: string }, @Request() req) {
    return this.orderService.auditMaterial(id, body.status, body.remark, req.user.id);
  }

  @Get('admin/statistics')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理端：订单统计' })
  async getStatistics() {
    return this.orderService.getStatistics();
  }

  // ==================== 订单分配与交付 ====================

  @Post(':id/assign')
  @Log("订单", "分配", ":id/assign")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '分配订单给网点' })
  async assignOrder(
    @Param('id') id: string,
    @Body() dto: { outlet_id?: string; outletId?: string; remark?: string },
    @Request() req: any,
  ) {
    const outletId = dto.outlet_id ?? dto.outletId;
    if (!outletId) throw new BadRequestException('缺少网点ID');
    return this.orderService.assignOrder(id, outletId, dto.remark, req.user.id as string);
  }

  @Put(':id/accept')
  @Log("订单", "接单", ":id/accept")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点接单（管理后台代接，以网点身份）' })
  async acceptOrder(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const outletId = body?.outletId || req.user.id;
    return this.orderService.acceptOrder(id, outletId);
  }

  @Put(':id/deliver')
  @Log("订单", "deliver", ":id/deliver")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点提交交付（自动生效）' })
  async deliverOrder(
    @Param('id') id: string,
    @Body() dto: { express_company: string; express_no: string; receipts: Array<{ type: string; url: string; remark?: string }>; remark?: string; outletId?: string },
    @Request() req: any,
  ) {
    const outletId = dto?.outletId || req.user.id;
    return this.orderService.deliverOrder(id, dto, outletId);
  }

  @Put(':id/sign')
  @Log("订单", "签收", ":id/sign")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '客户确认签收' })
  async signOrder(@Param('id') id: string) {
    return this.orderService.signOrder(id);
  }

  @Get(':id/delivery-info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '订单交付信息' })
  async getDeliveryInfo(@Param('id') id: string) {
    return this.orderService.getDeliveryInfo(id);
  }

  // ==================== 网点端接口 ====================

  @Get('Outlet/:id')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点端：订单详情（含凭证）' })
  async getStoreOrderDetail(@Param('id') id: string, @Request() req: any) {
    return this.orderService.getStoreOrderDetail(id, req.user.id);
  }

  // ==================== 参数化路由（放最后，避免覆盖硬编码路由） ====================

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取订单详情' })
  async getOrderDetail(@Param('id') id: string, @Request() req) {
    return this.orderService.getOrderDetail(id, req.user.id);
  }

  @Post(':id/pay')
  @Log("订单", "支付", ":id/pay")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '发起微信支付（获取支付参数）' })
  async createPayOrder(@Param('id') id: string, @Request() req, @Body() body: { openid?: string }) {
    // 与 createSealOrder 一致：开发期容忍匿名用户，上线前恢复 JWT 鉴权
    const user_id = req.user?.id || '00000000-0000-0000-0000-000000000000';
    const openid = body.openid || req.user?.user?.openid || '';
    return this.orderService.createPayOrder(id, user_id, openid);
  }

  @Post(':id/dev-paid')
  @Log("订单", "dev-paid", ":id/dev-paid")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  // 仅开发/测试环境可用；生产环境 NODE_ENV=production 时控制器拦截返回 403
  @ApiOperation({ summary: '【开发专用】模拟微信支付回调（生产环境禁用）' })
  async devConfirmPaid(@Param('id') id: string, @Request() req) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('生产环境不允许模拟支付');
    }
    const user_id = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.orderService.devConfirmPaid(id, user_id);
  }

  @Post(':id/cancel')
  @Log("订单", "取消", ":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户取消订单（仅限未支付订单）已支付订单退款请联系管理员' })
  async cancelOrder(@Param('id') id: string, @Request() req) {
    const user_id = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.orderService.cancelOrder(id, user_id);
  }

  @Post(':id/refund')
  @Log("订单", "退款", ":id/refund")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员退款（已支付订单）' })
  async refundOrder(@Param('id') id: string, @Body() body: any, @Request() req) {
    return this.orderService.refundOrder(id, req.user?.id, body?.amount, body?.reason);
  }
}
