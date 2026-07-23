import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('管理端')
@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '管理后台数据总览' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('admins')
  @ApiOperation({ summary: '管理员列表' })
  async getAdmins(@Query() query: any) {
    return this.adminService.getAdmins(query);
  }

  @Post('admins')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  @ApiOperation({ summary: '创建管理员（仅 superadmin）' })
  @Log('管理员', '创建管理员', '管理员 {id}')
  async createAdmin(@Body() dto: any) {
    return this.adminService.createAdmin(dto);
  }

  @Put('admins/:id')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  @ApiOperation({ summary: '更新管理员（仅 superadmin）' })
  @Log('管理员', '更新管理员', '管理员 {id}')
  async updateAdmin(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updateAdmin(id, dto);
  }

  @Delete('admins/:id')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  @ApiOperation({ summary: '删除管理员（仅 superadmin）' })
  @Log('管理员', '删除管理员', '管理员 {id}')
  async deleteAdmin(@Param('id') id: string) {
    return this.adminService.deleteAdmin(id);
  }

  @Get('logs')
  @ApiOperation({ summary: '操作日志' })
  async getLogs(@Query() query: any) {
    return this.adminService.getLogs(query);
  }

  @Get('profile')
  @ApiOperation({ summary: '当前管理员信息' })
  async getProfile(@Request() req: any) {
    const adminId = req.user?.id;
    return this.adminService.getProfile(adminId);
  }
}
