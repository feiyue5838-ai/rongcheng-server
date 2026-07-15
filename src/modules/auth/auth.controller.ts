import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';

class WxLoginDto {
  code: string;
}

class AdminLoginDto {
  username: string;
  password: string;
}

class CreateSuperAdminDto {
  username: string;
  password: string;
}

class StoreLoginDto {
  phone: string;
  password: string;
}

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wx-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '微信小程序登录' })
  @ApiBody({ schema: { properties: { code: { type: 'string', description: '微信授权 code' } } } })
  async wxLogin(@Body() dto: WxLoginDto) {
    return this.authService.wxLogin(dto.code);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '管理后台登录' })
  @ApiBody({
    schema: {
      properties: {
        username: { type: 'string', example: 'admin' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.username, dto.password);
  }

  @Post('admin/init')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '初始化超级管理员（仅首次部署使用）' })
  async createSuperAdmin(@Body() dto: CreateSuperAdminDto) {
    return this.authService.createSuperAdmin(dto.username, dto.password);
  }

  @Post('Outlet/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '网点登录' })
  @ApiBody({
    schema: {
      properties: {
        phone: { type: 'string', example: '13800138000' },
        password: { type: 'string', example: '123456' },
      },
    },
  })
  async storeLogin(@Body() dto: StoreLoginDto) {
    return this.authService.storeLogin(dto.phone, dto.password);
  }
}