import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { JwtAuthGuard, AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('评价')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交评价' })
  async submit(@Request() req, @Body() dto: any) {
    return this.reviewService.submitReview(req.user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '我的评价列表' })
  async getMyReviews(@Request() req, @Query() query: any) {
    return this.reviewService.getMyReviews(req.user.id, query);
  }

  // 管理端
  @Get('admin/list')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '评价列表（管理端）' })
  async adminGetReviews(@Query() query: any) {
    return this.reviewService.adminGetReviews(query);
  }

  @Put(':id/reply')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回复评价' })
  async reply(@Param('id') id: string, @Body() dto: { reply: string }) {
    return this.reviewService.adminReplyReview(id, dto.reply);
  }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除评价' })
  async delete(@Param('id') id: string) {
    return this.reviewService.adminDeleteReview(id);
  }
}
