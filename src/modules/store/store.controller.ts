import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreService } from './store.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreJwtAuthGuard } from '../auth/guards/store-jwt-auth.guard';

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

@ApiTags('门店管理')
@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // ==================== 管理员接口 ====================

  @Get()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '门店列表' })
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
  @ApiOperation({ summary: '门店详情' })
  async findOne(@Param('id') id: string) {
    return this.storeService.findOne(id);
  }

  @Post()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增门店' })
  async create(@Body() dto: CreateStoreDto) {
    return this.storeService.create(dto);
  }

  @Put(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑门店' })
  async update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.storeService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除门店' })
  async remove(@Param('id') id: string) {
    return this.storeService.remove(id);
  }

  @Post(':id/reset-password')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '重置门店密码' })
  async resetPassword(@Param('id') id: string) {
    return this.storeService.resetPassword(id);
  }

  // 门店端：获取自己的订单列表（从 token 中提取 storeId）
  @Get('me/orders')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '门店订单列表（门店端）' })
  async getMyOrders(@Request() req: any) {
    return this.storeService.getStoreOrders(req.user.id, { page: 1, pageSize: 100 });
  }

  @Get(':storeId/orders')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '门店订单列表（管理端查看）' })
  async getStoreOrders(
    @Param('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: number,
  ) {
    return this.storeService.getStoreOrders(storeId, { page: Number(page) || 1, pageSize: Number(pageSize) || 20, status });
  }
}
