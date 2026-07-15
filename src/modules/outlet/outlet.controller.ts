import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreService } from './Outlet.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreJwtAuthGuard } from '../auth/guards/Outlet-jwt-auth.guard';

class CreateStoreDto {
  name: string;
  contact: string;
  phone: string;
  province?: string;
  city?: string;
  address?: string;
}

class UpdateStoreDto {
  name?: string;
  contact?: string;
  phone?: string;
  province?: string;
  city?: string;
  address?: string;
  status?: number;
}

@ApiTags('网点管理')
@Controller('outlets')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // ==================== 管理员接口 ====================

  @Get()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点列表' })
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('keyword') keyword?: string,
    @Query('status') status?: number,
  ) {
    return this.storeService.findAll({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, keyword, status });
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
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑网点' })
  async update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.storeService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除网点' })
  async remove(@Param('id') id: string) {
    return this.storeService.remove(id);
  }

  @Post(':id/reset-password')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '重置网点密码' })
  async resetPassword(@Param('id') id: string) {
    return this.storeService.resetPassword(id);
  }

  // 网点端：获取自己的订单列表（从 token 中提取 outletId）
  @Get('me/orders')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点订单列表（网点端）' })
  async getMyOrders(@Request() req: any) {
    return this.storeService.getStoreOrders(req.user.id, { page: 1, pageSize: 100 });
  }

  @Get(':outletId/orders')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点订单列表（管理端查看）' })
  async getStoreOrders(
    @Param('outletId') outletId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: number,
  ) {
    return this.storeService.getStoreOrders(outletId, { page: Number(page) || 1, pageSize: Number(pageSize) || 20, status });
  }
}
