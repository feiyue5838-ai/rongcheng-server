import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

class WxLoginDto {
  @IsString() @IsNotEmpty()
  code: string;
}

class AdminLoginDto {
  @IsString() @IsNotEmpty()
  username: string;
  @IsString() @IsNotEmpty()
  password: string;
}

class CreateSuperAdminDto {
  @IsString() @IsNotEmpty()
  username: string;
  @IsString() @IsNotEmpty()
  password: string;
}

class StoreLoginDto {
  @IsString() @IsNotEmpty()
  phone: string;
  @IsString() @IsNotEmpty()
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
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5次/分钟
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
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3次/小时
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '初始化超级管理员（仅首次部署使用）' })
  async createSuperAdmin(@Body() dto: CreateSuperAdminDto) {
    return this.authService.createSuperAdmin(dto.username, dto.password);
  }

  // 小程序网点端登录（/api/auth/store-login 兼容旧路径）
  @Post('store-login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5次/分钟
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '网点登录（小程序端）' })
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

  @Post('Outlet/login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5次/分钟
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '网点登录（Web 端）' })
  @ApiBody({
    schema: {
      properties: {
        phone: { type: 'string', example: '13800138000' },
        password: { type: 'string', example: '123456' },
      },
    },
  })
  async storeLoginForWeb(@Body() dto: StoreLoginDto) {
    return this.authService.storeLogin(dto.phone, dto.password);
  }
}