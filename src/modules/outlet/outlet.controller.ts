import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreService } from './Outlet.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreJwtAuthGuard } from '../auth/guards/Outlet-jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

class CreateStoreDto {
  name: string;
  contact: string;
  phone: string;
  province?: string;
  city?: string;
  address?: string;
  business_license?: string;
  special_permits?: string[];
  businessTypeIds?: string[];
}

class UpdateStoreDto {
  name?: string;
  contact?: string;
  phone?: string;
  province?: string;
  city?: string;
  address?: string;
  status?: number;
  business_license?: string;
  special_permits?: string[];
  businessTypeIds?: string[];
}

@ApiTags('网点管理')
@Controller('outlets')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // ==================== 管理员接口 ====================

  // 独立接口：设置网点业务授权（弹窗专用，不走完整编辑流程）
  @Put(':id/business-types')
  @Log("网点", "业务授权", ":id/business-types")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置网点业务授权' })
  async setBusinessTypes(@Param('id') id: string, @Body() dto: { businessTypeIds: string[] }) {
    return this.storeService.setBusinessTypes(id, dto.businessTypeIds);
  }

  @Get()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点列表' })
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('status') status?: number,
    @Query('region') region?: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('businessType') businessType?: string,
  ) {
    return this.storeService.findAll({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, keyword, status, region, province, city, district, businessType });
  }

  @Get('admin/overview')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '全网点总览' })
  async getOverview() {
    return this.storeService.getOverview();
  }

  @Get(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点详情' })
  async findOne(@Param('id') id: string) {
    return this.storeService.findOne(id);
  }

  @Post()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增网点' })
  async create(@Body() dto: CreateStoreDto) {
    return this.storeService.create(dto);
  }

  @Put(':id')
  @Log("网点", "更新网点", ":id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑网点' })
  async update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.storeService.update(id, dto);
  }

  @Delete(':id')
  @Log("网点", "删除网点", ":id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除网点' })
  async remove(@Param('id') id: string) {
    return this.storeService.remove(id);
  }

  @Post(':id/reset-password')
  @Log("网点", "密码重置", ":id/reset-password")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '重置网点密码' })
  async resetPassword(@Param('id') id: string) {
    return this.storeService.resetPassword(id);
  }

  // 网点端：获取自己的订单列表（从 token 中提取 outlet_id）
  @Get('me/orders')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点订单列表（网点端）' })
  async getMyOrders(@Request() req: any) {
    return this.storeService.getStoreOrders(req.user.id, { page: 1, pageSize: 100 });
  }

  // 网点端：单条订单详情
  @Get('me/orders/:id')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点订单详情（网点端）' })
  async getMyOrderDetail(@Param('id') order_id: string, @Request() req: any) {
    return this.storeService.getStoreOrderDetail(req.user.id, order_id);
  }

  // 网点端：接单
  @Put('me/orders/:id/accept')
  @Log("网点", "订单", "me/orders/:id/accept")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点接单' })
  async acceptOrder(@Param('id') order_id: string, @Request() req: any) {
    return this.storeService.acceptOrder(req.user.id, order_id);
  }

  // 网点端：完成制作
  @Put('me/orders/:id/complete')
  @Log("网点", "订单", "me/orders/:id/complete")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点完成制作' })
  async completeOrder(@Param('id') order_id: string, @Body() body: { remark?: string }, @Request() req: any) {
    return this.storeService.completeOrder(req.user.id, order_id, body.remark);
  }

  // 网点端：发货
  @Put('me/orders/:id/ship')
  @Log("网点", "订单", "me/orders/:id/ship")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点发货' })
  async shipOrder(@Param('id') order_id: string, @Body() body: { trackingNo?: string; remark?: string }, @Request() req: any) {
    return this.storeService.shipOrder(req.user.id, order_id, body.trackingNo, body.remark);
  }

  @Put('me/bind-openid')
  @Log("网点", "绑定OpenID", "me/bind-openid")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点端：绑定微信 openid（接收订阅消息）' })
  async bindOpenid(@Body() dto: { openid: string }, @Request() req: any) {
    return this.storeService.bindOpenid(req.user.id, dto.openid);
  }

  @Put('me/subscribe-toggle')
  @Log("网点", "订阅设置", "me/subscribe-toggle")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点端：开关订阅消息' })
  async toggleSubscribe(@Body() dto: { enabled: boolean }, @Request() req: any) {
    return this.storeService.toggleSubscribe(req.user.id, dto.enabled);
  }

  @Get(':outlet_id/orders')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点订单列表（管理端查看）' })
  async getStoreOrders(
    @Param('outlet_id') outlet_id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: number,
  ) {
    return this.storeService.getStoreOrders(outlet_id, { page: Number(page) || 1, pageSize: Number(pageSize) || 20, status });
  }
}
