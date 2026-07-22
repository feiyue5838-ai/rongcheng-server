import { Controller, Get, Put, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { StoreJwtAuthGuard } from '../auth/guards/Outlet-jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('网点通知')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('me')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点端：获取我的通知' })
  async getMyNotifications(@Request() req: any) {
    return this.notificationService.getMyNotifications(req.user.id);
  }

  @Put('read')
  @Log("通知", "已读", "read")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点端：全部标记已读' })
  async markAllRead(@Request() req: any) {
    return this.notificationService.markAllRead(req.user.id);
  }

  @Put(':id/read')
  @Log("通知", "已读", ":id/read")
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '网点端：单条标记已读' })
  async markRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationService.markRead(req.user.id, id);
  }
}
