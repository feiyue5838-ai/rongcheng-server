import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { JwtAuthGuard, AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('评价')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // ===== 小程序端 =====

  /** 提交评价（需登录） */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交评价' })
  async submit(@Request() req, @Body() dto: any) {
    return this.reviewService.submitReview(req.user.id, dto);
  }

  /** 我的评价列表 */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '我的评价列表' })
  async getMyReviews(@Request() req, @Query() query: any) {
    return this.reviewService.getMyReviews(req.user.id, query);
  }

  /** 公开评价列表（已审核通过） */
  @Get('list')
  @ApiOperation({ summary: '已审核评价列表（小程序端）' })
  async getApprovedReviews(@Query() query: any) {
    return this.reviewService.getApprovedReviews(query);
  }

  // ===== 管理端 =====

  @Get('admin/list')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '评价列表（管理端）' })
  async adminGetReviews(@Query() query: any) {
    return this.reviewService.adminGetReviews(query);
  }

  @Put(':id/status')
  @Log("评价", "状态", ":id/status")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '审核评价' })
  async updateStatus(@Param('id') id: string, @Body() dto: { status: string }) {
    return this.reviewService.adminUpdateStatus(id, dto.status);
  }

  @Put(':id/reply')
  @Log("评价", "回复", ":id/reply")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回复评价' })
  async reply(@Param('id') id: string, @Body() dto: { reply: string }) {
    return this.reviewService.adminReplyReview(id, dto.reply);
  }

  @Delete(':id')
  @Log("评价", ":id", ":id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除评价' })
  async delete(@Param('id') id: string) {
    return this.reviewService.adminDeleteReview(id);
  }
}
