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
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  @ApiOperation({ summary: '管理员列表（仅 superadmin）' })
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
  async updateAdmin(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    // U-06: 传入当前管理员 ID，用于校验不能修改自己
    return this.adminService.updateAdmin(id, dto, req.user?.id);
  }

  @Delete('admins/:id')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  @ApiOperation({ summary: '删除管理员（仅 superadmin）' })
  @Log('管理员', '删除管理员', '管理员 {id}')
  async deleteAdmin(@Param('id') id: string, @Request() req: any) {
    return this.adminService.deleteAdmin(id, req.user?.id);
  }

  @Get('logs')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  @ApiOperation({ summary: '操作日志（仅 superadmin）' })
  async getLogs(@Query() query: any) {
    return this.adminService.getLogs(query);
  }

  @Get('logs/modules')
  @ApiOperation({ summary: '日志模块列表' })
  async getLogModules() {
    return this.adminService.getLogModules();
  }

  @Get('profile')
  @ApiOperation({ summary: '当前管理员信息' })
  async getProfile(@Request() req: any) {
    const admin_id = req.user?.id;
    return this.adminService.getProfile(admin_id);
  }
}
