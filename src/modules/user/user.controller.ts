import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard, AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('用户')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取个人资料' })
  async getProfile(@Request() req) {
    return this.userService.getProfile(req.user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新个人资料' })
  async updateProfile(@Request() req, @Body() dto: any) {
    return this.userService.updateProfile(req.user.id, dto);
  }

  @Get('addresses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '收货地址列表' })
  async getAddresses(@Request() req) {
    return this.userService.getAddresses(req.user.id);
  }

  @Post('addresses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '添加收货地址' })
  async addAddress(@Request() req, @Body() dto: any) {
    return this.userService.addAddress(req.user.id, dto);
  }

  @Put('addresses/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新收货地址' })
  async updateAddress(@Request() req, @Param('id') id: string, @Body() dto: any) {
    return this.userService.updateAddress(req.user.id, id, dto);
  }

  @Delete('addresses/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除收货地址' })
  async deleteAddress(@Request() req, @Param('id') id: string) {
    return this.userService.deleteAddress(req.user.id, id);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '发票列表' })
  async getInvoices(@Request() req) {
    return this.userService.getInvoices(req.user.id);
  }

  @Post('invoices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '添加发票' })
  async addInvoice(@Request() req, @Body() dto: any) {
    return this.userService.addInvoice(req.user.id, dto);
  }

  // 管理端
  @Get('admin/list')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户列表（管理端）' })
  async adminGetUsers(@Query() query: any) {
    return this.userService.adminGetUsers(query);
  }
}
