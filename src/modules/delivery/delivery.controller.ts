import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreJwtAuthGuard } from '../auth/guards/store-jwt-auth.guard';
import { UploadService } from '../upload/upload.service';

@ApiTags('交付回执')
@Controller('delivery-receipts')
export class DeliveryReceiptController {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  @Get()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执列表（管理端）' })
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('storeId') storeId?: string,
    @Query('orderId') orderId?: string,
  ) {
    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;
    const where: any = {};
    if (storeId) where.storeId = storeId;
    if (orderId) where.orderId = orderId;

    const [list, total] = await Promise.all([
      this.prisma.deliveryReceipt.findMany({
        where,
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
        orderBy: { createdAt: 'desc' },
        include: {
          store: { select: { id: true, name: true, contact: true, phone: true } },
          order: {
            select: {
              id: true,
              orderNo: true,
              companyName: true,
              type: true,
              status: true,
              statusText: true,
              deliveredAt: true,
              updatedAt: true,
              orderItems: {
                select: { id: true, name: true, itemType: true, image: true },
              },
            },
          },
        },
      }),
      this.prisma.deliveryReceipt.count({ where }),
    ]);

    return {
      list,
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages: Math.ceil(total / pageSizeNum) },
    };
  }

  @Post()
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '提交交付回执（门店端）' })
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('orderId') orderId: string,
    @Body('type') type: string,
    @Body('remark') remark: string,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('请上传回执图片');
    if (!orderId) throw new BadRequestException('缺少订单 ID');

    const storeId = req.user.storeId;

    // 上传图片
    const url = await this.uploadService.uploadFile(file, 'receipts');

    // 创建回执记录
    const receipt = await this.prisma.deliveryReceipt.create({
      data: {
        orderId,
        storeId,
        type: type || 'certificate',
        url,
        remark,
      },
      include: {
        store: { select: { id: true, name: true, phone: true } },
      },
    });

    // 更新订单状态 → 已发货
    await this.prisma.sealOrder.update({
      where: { id: orderId },
      data: { status: 4, statusText: '已发货' },
    });

    // 更新分配状态 → 已完成
    await this.prisma.orderAssignment.update({
      where: { orderId },
      data: { status: 3, statusText: '已完成', completedAt: new Date() },
    });

    return receipt;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执详情（用户端）' })
  async findOne(@Param('id') id: string) {
    const receipt = await this.prisma.deliveryReceipt.findUnique({ where: { id } });
    return receipt;
  }
}
