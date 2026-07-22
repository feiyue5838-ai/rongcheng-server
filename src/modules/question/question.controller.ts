import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuestionService } from './question.service';
import { JwtAuthGuard, AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Log } from '../../common/decorators/log.decorator';

@ApiTags('问答')
@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  // ===== 小程序端 =====

  /** 提问（需登录） */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交问题' })
  async create(@Request() req, @Body() dto: any) {
    return this.questionService.create(req.user.id, dto);
  }

  /** 公开问答列表 */
  @Get('list')
  @ApiOperation({ summary: '问答列表（小程序端）' })
  async getPublicList(@Query() query: any) {
    return this.questionService.getPublicList(query);
  }

  /** 问答详情 */
  @Get(':id')
  @ApiOperation({ summary: '问答详情' })
  async getDetail(@Param('id') id: string) {
    return this.questionService.getDetail(id);
  }

  // ===== 管理端 =====

  @Get('admin/list')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '问答列表（管理端）' })
  async adminList(@Query() query: any) {
    return this.questionService.adminList(query);
  }

  @Put(':id/status')
  @Log("问答", "状态", ":id/status")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '审核问题' })
  async updateStatus(@Param('id') id: string, @Body() dto: { status: string }) {
    return this.questionService.adminUpdateStatus(id, dto.status);
  }

  @Post(':id/replies')
  @Log("问答", "replies", ":id/replies")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回复问题' })
  async reply(@Param('id') id: string, @Request() req, @Body() dto: { content: string }) {
    const admin = (req as any).user;
    return this.questionService.adminReply(id, admin.id, admin.nickname || '管理员', dto.content);
  }

  @Delete(':id')
  @Log("问答", ":id", ":id")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除问题' })
  async delete(@Param('id') id: string) {
    return this.questionService.adminDelete(id);
  }

  @Delete('replies/:replyId')
  @Log("问答", "回复", "replies/:replyId")
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除回复' })
  async deleteReply(@Param('replyId') replyId: string) {
    return this.questionService.adminDeleteReply(replyId);
  }
}
