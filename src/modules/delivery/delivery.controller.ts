import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreJwtAuthGuard } from '../auth/guards/Outlet-jwt-auth.guard';
import { UploadService } from '../upload/upload.service';
import { REGION_MAP, provinceToRegion, getProvincesByRegion } from '../../common/region';
import { Log } from '../../common/decorators/log.decorator';

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
    @Query('order_id') order_id: string,
    @Request() req: any,
  ) {
    if (!order_id) {
      return { list: [] };
    }

    // 校验订单归属（确保用户只能查看自己订单的回执）
    const order = await this.prisma.seal_orders.findFirst({
      where: { id: order_id, user_id: req.user.id },
      select: { id: true },
    });
    if (!order) {
      return { list: [] };
    }

    const list = await this.prisma.delivery_receipts.findMany({
      where: { order_id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        order_id: true,
        type: true,
        url: true,
        remark: true,
        created_at: true,
      },
    });

    return { list };
  }

  @Get('stats')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执统计（管理端）' })
  async getStats() {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const [total, sealCount, certificateCount, todayCount] = await Promise.all([
      this.prisma.delivery_receipts.count(),
      this.prisma.delivery_receipts.count({ where: { type: 'seal' } }),
      this.prisma.delivery_receipts.count({ where: { type: 'certificate' } }),
      this.prisma.delivery_receipts.count({
        where: { created_at: { gte: startOfToday, lte: endOfToday } },
      }),
    ]);

    return { total, sealCount, certificateCount, todayCount };
  }

  @Get()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执列表（管理端）' })
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('outlet_id') outlet_id?: string,
    @Query('order_id') order_id?: string,
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

    // outlet 筛选：先把满足地域条件的 outlet_id 找出来
    const outletWhere: any = {};
    if (outlet_id) outletWhere.id = outlet_id;
    if (province) outletWhere.province = province;
    if (city) outletWhere.city = city;
    if (region) {
      const provinces = getProvincesByRegion(region);
      outletWhere.province = { in: provinces };
    }
    let outletIds: string[] | undefined;
    if (Object.keys(outletWhere).length > 0) {
      const ids = await this.prisma.outlets.findMany({ where: outletWhere, select: { id: true } });
      outletIds = ids.map(o => o.id);
      // 地域筛选下没匹配到网点 → 直接返回空
      if (outletIds.length === 0) {
        return { list: [], pagination: { page: pageNum, pageSize: pageSizeNum, total: 0, totalPages: 0 } };
      }
    }

    const where: any = {};
    if (outletIds) where.outlet_id = { in: outletIds };
    if (order_id) where.order_id = order_id;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.created_at.lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    if (keyword) {
      where.seal_orders = {
        OR: [
          { order_no: { contains: keyword, mode: 'insensitive' } },
          { company_name: { contains: keyword, mode: 'insensitive' } },
        ],
      };
    }

    const [list, total] = await Promise.all([
      this.prisma.delivery_receipts.findMany({
        where,
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
        orderBy: { created_at: 'desc' },
        include: {
          outlet: { select: { id: true, name: true, contact: true, phone: true, province: true, city: true } },
          seal_orders: {
            select: {
              id: true,
              order_no: true,
              company_name: true,
              type: true,
              status: true,
              status_text: true,
              express_company: true,
              express_no: true,
              delivery_status: true,
              delivered_at: true,
              updated_at: true,
              order_items: {
                select: { id: true, name: true, item_type: true, image: true },
              },
            },
          },
        },
      }),
      this.prisma.delivery_receipts.count({ where }),
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
  @Log('快递', '创建快递单')
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('order_id') order_id: string,
    @Body('type') type: string,
    @Body('remark') remark: string,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('请上传回执图片');
    if (!order_id) throw new BadRequestException('缺少订单 ID');

    const outlet_id = req.user.id;

    // 上传图片
    const url = await this.uploadService.uploadFile(file, 'receipts');

    // 查询订单（SealOrder 表存刻章+登报，module 字段区分）
    const order = await this.prisma.seal_orders.findUnique({
      where: { id: order_id },
      select: { id: true, module: true },
    });

    if (!order) {
      throw new BadRequestException('订单不存在');
    }

    // 创建回执记录
    const receipt = await this.prisma.delivery_receipts.create({
      data: {
        order_id,
        outlet_id,
        type: type || 'certificate',
        url,
        remark,
      },
      include: { outlet: { select: { id: true, name: true, phone: true } } },
    });

    // 更新订单状态 → 已完成（网点交付即完单，无需客户额外确认）
    await this.prisma.seal_orders.update({
      where: { id: order_id },
      data: { status: 4, status_text: '已完成' },
    });

    // 刻章订单：更新分配状态 → 已完成（登报订单无 orderAssignment）
    if (order.module === 'seal') {
      const activeAssign = await this.prisma.order_assignments.findFirst({ where: { order_id, is_active: true } });
      if (activeAssign) {
        await this.prisma.order_assignments.update({
          where: { id: activeAssign.id },
          data: { status: 3, status_text: '已完成', completed_at: new Date(), is_active: false },
        });
      }
    }

    return receipt;
  }

  @Get('Outlet/list')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执列表（网点端）' })
  async findAllByOutlet(
    @Query('order_id') order_id: string,
    @Request() req: any,
  ) {
    const outlet_id = req.user.id;
    const where: any = { outlet_id };
    if (order_id) where.order_id = order_id;

    const list = await this.prisma.delivery_receipts.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        order_id: true,
        outlet_id: true,
        type: true,
        url: true,
        remark: true,
        created_at: true,
      },
    });

    return { list };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '回执详情（用户端）' })
  async findOne(@Param('id') id: string) {
    const receipt = await this.prisma.delivery_receipts.findUnique({ where: { id } });
    return receipt;
  }
}
