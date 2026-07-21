import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreJwtAuthGuard } from '../auth/guards/Outlet-jwt-auth.guard';
import { UploadService } from '../upload/upload.service';
import { REGION_MAP, provinceToRegion, getProvincesByRegion } from '../../common/region';

@ApiTags('交付回执')
@Controller('delivery-receipts')
export class DeliveryReceiptController {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  @Get('user/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执列表（用户端）' })
  async findByUser(
    @Query('orderId') orderId: string,
    @Request() req: any,
  ) {
    if (!orderId) {
      return { list: [] };
    }

    // 校验订单归属（确保用户只能查看自己订单的回执）
    const order = await this.prisma.sealOrder.findFirst({
      where: { id: orderId, userId: req.user.id },
      select: { id: true },
    });
    if (!order) {
      return { list: [] };
    }

    const list = await this.prisma.deliveryReceipt.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        type: true,
        url: true,
        remark: true,
        createdAt: true,
      },
    });

    return { list };
  }

  @Get()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执列表（管理端）' })
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('outletId') outletId?: string,
    @Query('orderId') orderId?: string,
    @Query('keyword') keyword?: string,
    @Query('type') type?: string,
    @Query('region') region?: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;

    // outlet 筛选：先把满足地域条件的 outletId 找出来
    const outletWhere: any = {};
    if (outletId) outletWhere.id = outletId;
    if (province) outletWhere.province = province;
    if (city) outletWhere.city = city;
    if (region) {
      const provinces = getProvincesByRegion(region);
      outletWhere.province = { in: provinces };
    }
    let outletIds: string[] | undefined;
    if (Object.keys(outletWhere).length > 0) {
      const ids = await this.prisma.outlet.findMany({ where: outletWhere, select: { id: true } });
      outletIds = ids.map(o => o.id);
      // 地域筛选下没匹配到网点 → 直接返回空
      if (outletIds.length === 0) {
        return { list: [], pagination: { page: pageNum, pageSize: pageSizeNum, total: 0, totalPages: 0 } };
      }
    }

    const where: any = {};
    if (outletIds) where.outletId = { in: outletIds };
    if (orderId) where.orderId = orderId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    if (keyword) {
      where.order = {
        OR: [
          { orderNo: { contains: keyword, mode: 'insensitive' } },
          { companyName: { contains: keyword, mode: 'insensitive' } },
        ],
      };
    }

    const [list, total] = await Promise.all([
      this.prisma.deliveryReceipt.findMany({
        where,
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
        orderBy: { createdAt: 'desc' },
        include: { outlet: { select: { id: true, name: true, contact: true, phone: true, province: true, city: true } },
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

    // 给每条回执补 outlet.region 派生字段
    const listWithRegion = list.map(r => ({
      ...r,
      outlet: r.outlet ? { ...r.outlet, region: provinceToRegion(r.outlet.province) } : null,
    }));

    return {
      list: listWithRegion,
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages: Math.ceil(total / pageSizeNum) },
    };
  }

  @Post()
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '提交交付回执（网点端）' })
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

    const outletId = req.user.id;

    // 上传图片
    const url = await this.uploadService.uploadFile(file, 'receipts');

    // 查询订单（SealOrder 表存刻章+登报，module 字段区分）
    const order = await this.prisma.sealOrder.findUnique({
      where: { id: orderId },
      select: { id: true, module: true },
    });

    if (!order) {
      throw new BadRequestException('订单不存在');
    }

    // 创建回执记录
    const receipt = await this.prisma.deliveryReceipt.create({
      data: {
        orderId,
        outletId,
        type: type || 'certificate',
        url,
        remark,
      },
      include: { outlet: { select: { id: true, name: true, phone: true } } },
    });

    // 更新订单状态 → 已发货
    await this.prisma.sealOrder.update({
      where: { id: orderId },
      data: { status: 4, statusText: '已发货' },
    });

    // 刻章订单：更新分配状态 → 已完成（登报订单无 orderAssignment）
    if (order.module === 'seal') {
      await this.prisma.orderAssignment.update({
        where: { orderId },
        data: { status: 3, statusText: '已完成', completedAt: new Date() },
      });
    }

    return receipt;
  }

  @Get('Outlet/list')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执列表（网点端）' })
  async findAllByOutlet(
    @Query('orderId') orderId: string,
    @Request() req: any,
  ) {
    const outletId = req.user.id;
    const where: any = { outletId };
    if (orderId) where.orderId = orderId;

    const list = await this.prisma.deliveryReceipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        outletId: true,
        type: true,
        url: true,
        remark: true,
        createdAt: true,
      },
    });

    return { list };
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
