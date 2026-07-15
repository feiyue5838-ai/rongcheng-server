import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('admin/login')
  async adminLogin(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Post('admin/init')
  async initAdmin(@Body() body: { username: string; password: string }) {
    return this.authService.initAdmin(body.username, body.password);
  }
}
