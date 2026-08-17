// V2.0 供应商端控制器
// 路由前缀: /api/v2/supplier

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FulfillmentService } from '../services/fulfillment.service';
import { SettlementV2Service } from '../services/settlement.service';
import { SupplierJwtAuthGuard } from '../../../common/guards/supplier-jwt.guard';
import { ResponseInterceptor } from '../../../common/interceptors/response.interceptor';
import { UploadService } from '../../upload/upload.service';

@Controller('v2/supplier')
@UseInterceptors(ResponseInterceptor)
export class SupplierController {
  constructor(
    private readonly fulfillmentService: FulfillmentService,
    private readonly settlementService: SettlementV2Service,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * 获取待接单/进行中订单
   * GET /api/v2/supplier/orders
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Get('orders')
  async getMyOrders(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.fulfillmentService.getSupplierOrders(req.user.supplierId, {
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  /**
   * 接单
   * POST /api/v2/supplier/orders/:fulfillmentId/accept
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/accept')
  async acceptOrder(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
  ) {
    return this.fulfillmentService.acceptOrder(fulfillmentId, req.user.supplierId);
  }

  /**
   * 拒单
   * POST /api/v2/supplier/orders/:fulfillmentId/reject
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/reject')
  async rejectOrder(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
    @Body('reason') reason: string,
  ) {
    return this.fulfillmentService.rejectOrder(fulfillmentId, req.user.supplierId, reason);
  }

  /**
   * 开始制作
   * POST /api/v2/supplier/orders/:fulfillmentId/start
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/start')
  async startProduction(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
  ) {
    return this.fulfillmentService.startProduction(fulfillmentId, req.user.supplierId);
  }

  /**
   * 发货
   * POST /api/v2/supplier/orders/:fulfillmentId/deliver
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/deliver')
  async deliverOrder(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
    @Body() body: { courier?: string; trackingNo?: string },
  ) {
    return this.fulfillmentService.deliverOrder(fulfillmentId, req.user.supplierId, body);
  }

  /**
   * 完成履约
   * POST /api/v2/supplier/orders/:fulfillmentId/complete
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('orders/:fulfillmentId/complete')
  async completeOrder(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
  ) {
    return this.fulfillmentService.completeOrder(fulfillmentId, req.user.supplierId);
  }

  /**
   * 上传回执照片（制作完成图/备案图/质检图）
   * POST /api/v2/supplier/fulfillments/:id/receipts
   * body(form-data): file=图片, type=production|filing|quality
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Post('fulfillments/:fulfillmentId/receipts')
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(
    @Param('fulfillmentId') fulfillmentId: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: 'production' | 'filing' | 'quality',
  ) {
    if (!file) throw new BadRequestException('请上传回执图片');
    const url = await this.uploadService.uploadFile(file, 'receipts');
    return this.fulfillmentService.uploadReceipt(fulfillmentId, req.user.supplierId, {
      type: type || 'production',
      urls: [url],
    });
  }

  // ============ 结算 ============

  /**
   * 我的结算单列表
   * GET /api/v2/supplier/settlements
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Get('settlements')
  async getSettlements(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.settlementService.getSupplierSettlements(req.user.supplierId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  /**
   * 结算单详情（含逐订单明细）
   * GET /api/v2/supplier/settlements/:id
   */
  @UseGuards(SupplierJwtAuthGuard)
  @Get('settlements/:id')
  async getSettlementDetail(@Param('id') id: string, @Request() req: any) {
    return this.settlementService.getSupplierSettlementDetail(id, req.user.supplierId);
  }
}
