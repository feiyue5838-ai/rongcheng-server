import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../wechat/wechat.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private wechatService: WechatService,
  ) {}

  // ==================== 全国网点自动分配 ====================

  /**
   * 根据收货地址自动匹配最近网点
   * 匹配规则：
   *   1. serviceArea JSON 中有精确 city 匹配优先
   *   2. 其次 province 匹配
   *   3. 都无 → 随机分配一个成都网点兜底
   */
  async autoAssignStore(addressJson: string | null, adminId?: string): Promise<{ outletId: string; storeName: string; matchType: string } | null> {
    if (!addressJson) return null;

    let province = '', city = '';
    try {
      const addr = JSON.parse(addressJson);
      province = addr.province || '';
      city = addr.city || '';
    } catch {
      return null;
    }

    // 查询所有启用网点
    const stores = await this.prisma.outlet.findMany({
      where: { status: 1 },
      select: { id: true, name: true, serviceArea: true },
    });

    if (stores.length === 0) return null;

    let bestStore: (typeof stores)[0] | null = null;
    let matchType = 'fallback';

    for (const Outlet of stores) {
      let serviceArea: Array<{ province: string; city?: string }> = [];
      try {
        serviceArea = JSON.parse(Outlet.serviceArea || '[]');
      } catch {
        serviceArea = [];
      }

      // 精确城市匹配（优先级最高）
      if (city) {
        const cityMatch = serviceArea.find(s => s.city === city);
        if (cityMatch) {
          bestStore = Outlet;
          matchType = `city:${city}`;
          break; // 精确匹配直接退出
        }
      }

      // 省份匹配（次优先，找第一个）
      if (!bestStore && province) {
        const provMatch = serviceArea.find(s => s.province === province);
        if (provMatch) {
          bestStore = Outlet;
          matchType = `province:${province}`;
        }
      }
    }

    // 无任何匹配 → 随机选一个成都网点兜底
    if (!bestStore) {
      const chengduStores = stores.filter(s => {
        try {
          const area = JSON.parse(s.serviceArea || '[]');
          return area.some((a: any) => a.province === '四川省' || a.city?.includes('成都'));
        } catch { return false; }
      });
      if (chengduStores.length > 0) {
        bestStore = chengduStores[Math.floor(Math.random() * chengduStores.length)];
        matchType = 'fallback:成都';
      } else {
        bestStore = stores[0];
        matchType = 'fallback:首位网点';
      }
    }

    return { outletId: bestStore.id, storeName: bestStore.name, matchType };
  }

  // ==================== 创建刻章订单 ====================

  async createSealOrder(userId: string, dto: any) {
    const {
      type,                   // 模式：company/personal/electronic/query
      companyName,
      sealReason,
      contactPhone,
      legalPhone,
      licenseRegion,
      addressId,
      remark,
      sealIds,
      packageId,
      items,
      addressJson,
    } = dto;

    // 1. 校验地址
    let addressData: any = null;
    if (addressId) {
      addressData = await this.prisma.address.findUnique({ where: { id: addressId } });
      if (!addressData) throw new NotFoundException('收货地址不存在');
    } else if (addressJson) {
      // 支持直接传入 addressJson（小程序端传入）
      try {
        addressData = typeof addressJson === 'string' ? JSON.parse(addressJson) : addressJson;
      } catch {
        addressData = null;
      }
    }

    // 2. 计算总价
    let totalPrice = 0;
    const orderItems: any[] = [];

    // 从 items（小程序端传入的订单明细）计算总价
    if (items && items.length > 0) {
      for (const item of items) {
        totalPrice += Number(item.price) * (item.quantity || 1);
        orderItems.push({
          itemType: item.itemType || 'seal',
          sealId: item.sealId || null,
          packageId: item.packageId || null,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          image: item.image || null,
        });
      }
    }

    // 3. 生成订单号
    const orderNo = this.generateOrderNo('RC');

    // 4. 创建订单
    const order = await this.prisma.sealOrder.create({
      data: {
        orderNo,
        userId,
        module: 'seal',
        type: type === 'company' ? '企业刻章' : type === 'personal' ? '个人印章' : type === 'electronic' ? '电子印章' : '刻章备案',
        companyName: companyName || null,
        licenseRegion: licenseRegion || null,
        sealReason: sealReason || null,
        contactPhone: contactPhone || null,
        legalPhone: legalPhone || null,
        totalPrice,
        addressId: addressId || null,
        addressJson: addressData ? JSON.stringify(addressData) : null,
        remark: remark || null,
        status: 1,
        statusText: '待支付',
        orderItems: {
          create: orderItems,
        },
      },
      include: {
        orderItems: true,
      },
    });

    // ⚠️ 安全要点：订单创建时一律保持『待支付』，绝不在下单接口里根据前端
    // 传入的 paidStatus 预置已付 / 触发网点分配。支付完成由微信支付回调（或开发
    // 模拟回调）通过 completePayment 统一处理（见下方方法）。前端永远不能自己判定
    // 支付成功。
    return order;
  }

  // ==================== 创建登报订单 ====================

  async createNewspaperOrder(userId: string, dto: any) {
    const { type, content, newspaperId, templateId, addressId, addressJson, remark, price, newspaperName, issueCount, invoice, copyCount, images } = dto;

    // 校验/快照地址（与刻章订单保持一致）
    let addressData: any = null;
    if (addressId) {
      addressData = await this.prisma.address.findUnique({ where: { id: addressId } });
      if (!addressData) throw new NotFoundException('收货地址不存在');
    } else if (addressJson) {
      try { addressData = typeof addressJson === 'string' ? JSON.parse(addressJson) : addressJson; } catch { addressData = null; }
    }

    // 服务端权威计价：单价 × max(字数, 最少字数) × 期数（覆盖客户端传入 price，防篡改）
    let serverPrice = Number(price) || 0;
    if (newspaperId) {
      const np = await this.prisma.newspaper.findUnique({ where: { id: newspaperId } });
      if (np) {
        const chars = (content || '').length;
        const words = Math.max(chars, np.minWords || 0);
        serverPrice = words * Number(np.pricePerWord) * (Number(issueCount) || 1);
      }
    }

    const orderNo = this.generateOrderNo('RB');
    const order = await this.prisma.sealOrder.create({
      data: {
        orderNo,
        userId,
        module: 'newspaper',
        type: type || '登报声明',
        totalPrice: serverPrice,
        contactPhone: addressData?.phone || null,
        addressId: addressId || null,
        addressJson: addressData ? JSON.stringify(addressData) : null,
        newspaperContent: content || null,
        newspaperIssueCount: issueCount ? Number(issueCount) : null,
        newspaperImages: Array.isArray(images) ? JSON.stringify(images) : null,
        newspaperCopyCount: copyCount ? Number(copyCount) : null,
        invoiceJson: invoice ? JSON.stringify(invoice) : null,
        remark: remark || null,
        status: 1,
        statusText: '待支付',
        orderItems: {
          create: [{
            itemType: 'newspaper',
            name: newspaperName || '报纸登报',
            price: serverPrice,
            quantity: 1,
          }],
        },
      },
      include: { orderItems: true },
    });

    return order;
  }

  /** 用户取消订单 / 申请退款：未支付→已取消(6)，已支付→退款中(7) */
  async cancelOrder(orderId: string, userId: string) {
    const order = await this.prisma.sealOrder.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status === 1) {
      return this.prisma.sealOrder.update({
        where: { id: orderId },
        data: { status: 6, statusText: '已取消' },
      });
    }
    if (order.status === 2) {
      // 已支付：进入退款中，由管理端处理实际微信退款
      return this.prisma.sealOrder.update({
        where: { id: orderId },
        data: { status: 7, statusText: '退款中' },
      });
    }
    throw new BadRequestException('当前订单状态不可取消');
  }

  // ==================== 订单列表（用户端） ====================

  async getMyOrders(userId: string, query: any) {
    const { page = 1, pageSize = 10, module, status } = query;
    const where: any = { userId };
    if (module) where.module = module;
    if (status) where.status = Number(status);

    const [orders, total] = await Promise.all([
      this.prisma.sealOrder.findMany({
        where,
        include: {
          orderItems: { include: { seal: true } },
          reviews: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.sealOrder.count({ where }),
    ]);

    return {
      list: orders,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    };
  }

  // ==================== 订单详情 ====================

  async getOrderDetail(orderId: string, userId?: string) {
    const where: any = { id: orderId };
    if (userId) where.userId = userId;

    const order = await this.prisma.sealOrder.findFirst({
      where,
      include: {
        user: { select: { id: true, nickname: true, phone: true } },
        orderItems: { include: { seal: true, package: true } },
        materials: true,
        reviews: { include: { user: { select: { nickname: true, avatar: true } } } },
        assignment: { include: { outlet: { select: { id: true, name: true, phone: true } } } },
        receipts: true,
      },
    });

    if (!order) throw new NotFoundException('订单不存在');

    return order;
  }

  // ==================== 微信支付 ====================

  async createPayOrder(orderId: string, userId: string, openid: string) {
    const order = await this.prisma.sealOrder.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 1) throw new BadRequestException('订单状态不允许支付');

    // 价格为 0：直接完成支付（仍走统一入口，自动分配网点）
    if (Number(order.totalPrice) === 0) {
      await this.completePayment({ id: orderId }, { payMethod: 'free' });
      return { type: 'free', orderId };
    }

    // 微信支付未配置（开发环境）：返回 dev 类型，由前端调用 dev-paid 模拟回调
    if (!this.wechatService.isPayConfigured()) {
      return { type: 'dev', orderId };
    }

    // 调用微信支付（统一下单）
    const payResult = await this.wechatService.createUnifiedOrder({
      outTradeNo: order.orderNo,
      totalFee: Math.round(Number(order.totalPrice) * 100), // 转为分
      body: `蓉城企服-${order.type}`,
      openid,
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || 'https://your-domain.com/api/wechat/pay-notify',
    });

    return {
      type: 'wechat',
      payment: payResult,
    };
  }

  // ==================== 支付完成（统一入口） ====================

  /**
   * 支付完成处理：置『已支付』并触发网点自动分配。
   * 这是「已支付 + 自动分配」的唯一真相源，只允许被以下路径调用：
   *   - 微信支付结果通知回调（wechat/pay-notify，已验签）
   *   - 免费订单（createPayOrder 内，price=0）
   *   - 开发环境模拟回调（dev-paid，生产环境禁用）
   * 微信回调到达前，订单一律保持『待支付』。
   */
  async completePayment(
    orderKey: { orderNo?: string; id?: string },
    pay: { payMethod: string; transactionId?: string },
  ) {
    const where: any = orderKey.orderNo ? { orderNo: orderKey.orderNo } : { id: orderKey.id };
    const order = await this.prisma.sealOrder.findFirst({ where });
    if (!order) throw new NotFoundException('订单不存在');

    // 幂等：微信可能重复推送回调，已支付则直接返回，避免重复分配
    if (order.status >= 2) return order;

    await this.prisma.sealOrder.update({
      where: { id: order.id },
      data: {
        status: 2,
        statusText: '已支付',
        // 修复：支付完成时记录实付金额，否则 payPrice 永久为 null，
        // 导致营收统计（sum payPrice）严重低估且订单详情缺实付金额
        payPrice: order.totalPrice,
        payTime: new Date(),
        payMethod: pay.payMethod,
        transactionId: pay.transactionId || null,
      },
    });

    // 支付成功后触发全国网点自动分配（仅未分配时）
    if (order.assignmentStatus === 0 && order.addressJson) {
      const assignResult = await this.autoAssignStore(order.addressJson, 'system');
      if (assignResult) {
        await this.prisma.orderAssignment.create({
          data: {
            orderId: order.id,
            outletId: assignResult.outletId,
            status: 1,
            statusText: '待接单',
            assignedBy: 'system',
            remark: `系统自动分配 [${assignResult.matchType}] → ${assignResult.storeName}`,
          },
        });
        await this.prisma.sealOrder.update({
          where: { id: order.id },
          data: { assignmentStatus: 1 },
        });
      }
    }

    return this.prisma.sealOrder.findFirst({ where: { id: order.id } });
  }

  /**
   * 开发环境模拟支付成功：仅当 NODE_ENV !== 'production' 可用。
   * 用于本地无真实商户号时模拟微信回调。生产环境调用会抛 403。
   */
  async devConfirmPaid(orderId: string, userId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('生产环境不允许模拟支付');
    }
    const order = await this.prisma.sealOrder.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('订单不存在');
    return this.completePayment({ id: orderId }, { payMethod: 'dev' });
  }

  // ==================== 管理端：订单列表 ====================

  async adminGetOrders(query: any) {
    const { page = 1, pageSize = 20, module, status, keyword, startDate, endDate } = query;
    const where: any = {};

    if (module) where.module = module;
    if (status) where.status = Number(status);
    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword } },
        { companyName: { contains: keyword } },
        { contactPhone: { contains: keyword } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      this.prisma.sealOrder.findMany({
        where,
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
          orderItems: { include: { seal: true } },
          assignment: { include: { outlet: { select: { id: true, name: true } } } },
          receipts: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.sealOrder.count({ where }),
    ]);

    return {
      list: orders.map(o => ({
        id: o.id,
        orderNo: o.orderNo,
        module: o.module,
        type: o.type,
        companyName: o.companyName,
        contactPhone: o.contactPhone,
        totalPrice: o.totalPrice,
        payPrice: o.payPrice,
        status: o.status,
        statusText: o.statusText,
        payTime: o.payTime,
        createdAt: o.createdAt,
        user: o.user,
        orderItems: o.orderItems,
        assignment: o.assignment ? (() => {
          const map: Record<number, string> = { 0: '待接单', 1: '已接单', 2: '制作中', 3: '已发货', 4: '已完成', 5: '已拒绝' };
          return { ...o.assignment, statusText: map[o.assignment.status] ?? o.assignment.statusText };
        })() : null,
        receipts: o.receipts,
      })),
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    };
  }

  // ==================== 管理端：更新订单状态 ====================

  async adminUpdateOrder(orderId: string, dto: any, adminId: string) {
    const order = await this.prisma.sealOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');

    const statusMap: Record<number, string> = {
      1: '待支付', 2: '已支付', 3: '制作中', 4: '已发货',
      5: '已完成', 6: '已取消', 7: '退款中', 8: '已退款',
    };

    const updateData: any = { ...dto };
    if (dto.status !== undefined) {
      updateData.statusText = statusMap[dto.status] || '未知状态';
    }

    updateData.processedBy = adminId;
    updateData.processedAt = new Date();

    return this.prisma.sealOrder.update({
      where: { id: orderId },
      data: updateData,
    });
  }

  // ==================== 统计 ====================

  async getStatistics() {
    // 使用 Asia/Shanghai 时区统计"今日"订单
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const shanghaiNow = new Date(utc + 8 * 3600000);
    const shanghaiStart = new Date(shanghaiNow.getFullYear(), shanghaiNow.getMonth(), shanghaiNow.getDate(), 0, 0, 0, 0);

    const [totalOrders, todayOrders, pendingOrders, totalRevenue] = await Promise.all([
      this.prisma.sealOrder.count(),
      this.prisma.sealOrder.count({ where: { createdAt: { gte: shanghaiStart } } }),
      this.prisma.sealOrder.count({ where: { status: 1 } }),
      this.prisma.sealOrder.aggregate({
        _sum: { payPrice: true },
        where: { status: { in: [2, 3, 4, 5] } },
      }),
    ]);

    return {
      totalOrders,
      todayOrders,
      pendingOrders,
      totalRevenue: totalRevenue._sum.payPrice || 0,
    };
  }

  // ==================== 订单分配与交付 ====================

  /** 待分配订单列表 */
  async getUnassignedOrders(params: { page: number; pageSize: number; module?: string; keyword?: string }) {
    const { page, pageSize, module, keyword } = params;
    const where: any = { assignmentStatus: 0, status: { in: [2, 3] } };
    if (module) where.module = module;
    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword } },
        { companyName: { contains: keyword } },
        { contactPhone: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.sealOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
          orderItems: true,
          assignment: {
            include: { outlet: { select: { id: true, name: true, phone: true } } },
          },
          receipts: true,
        },
      }),
      this.prisma.sealOrder.count({ where }),
    ]);

    return {
      list: list.map(o => ({
        id: o.id,
        orderNo: o.orderNo,
        module: o.module,
        type: o.type,
        companyName: o.companyName,
        contactPhone: o.contactPhone,
        totalPrice: o.totalPrice,
        payPrice: o.payPrice,
        status: o.status,
        statusText: o.statusText,
        payTime: o.payTime,
        createdAt: o.createdAt,
        user: o.user,
        orderItems: o.orderItems,
        assignment: o.assignment,
        receipts: o.receipts,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /** 分配订单给网点 */
  async assignOrder(orderId: string, outletId: string, remark: string | undefined, adminId: string) {
    const order = await this.prisma.sealOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status < 2) throw new BadRequestException('订单未支付，无法分配');
    if (order.assignmentStatus > 0) throw new BadRequestException('订单已分配，请勿重复分配');

    const Outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!Outlet) throw new NotFoundException('网点不存在');
    if (Outlet.status === 0) throw new BadRequestException('网点已被禁用');

    await this.prisma.$transaction([
      this.prisma.orderAssignment.create({
        data: {
          orderId,
          outletId,
          status: 1,
          statusText: '待接单',
          assignedBy: adminId,
          remark,
        },
      }),
      this.prisma.sealOrder.update({
        where: { id: orderId },
        data: { assignmentStatus: 1 },
      }),
    ]);

    return { message: '分配成功' };
  }

  /** 网点接单 */
  async acceptOrder(orderId: string, outletId: string) {
    const assignment = await this.prisma.orderAssignment.findUnique({
      where: { orderId },
    });
    if (!assignment) throw new NotFoundException('订单分配记录不存在');
    if (assignment.outletId !== outletId) throw new BadRequestException('无权操作此订单');
    if (assignment.status === 2) throw new BadRequestException('该订单已接单');
    if (assignment.status === 3) throw new BadRequestException('该订单已交付');

    await this.prisma.$transaction([
      this.prisma.orderAssignment.update({
        where: { id: assignment.id },
        data: { status: 2, statusText: '制作中', acceptedAt: new Date() },
      }),
      this.prisma.sealOrder.update({
        where: { id: orderId },
        data: { assignmentStatus: 2, statusText: '制作中' },
      }),
    ]);

    return { message: '接单成功' };
  }

  /** 网点提交交付（自动生效） */
  async deliverOrder(orderId: string, dto: { expressCompany: string; expressNo: string; receipts: Array<{ type: string; url: string; remark?: string }>; remark?: string }, outletId: string) {
    const assignment = await this.prisma.orderAssignment.findUnique({
      where: { orderId },
      include: { order: true },
    });
    if (!assignment) throw new NotFoundException('订单分配记录不存在');
    if (assignment.outletId !== outletId) throw new BadRequestException('无权操作此订单');
    if (assignment.status === 1) throw new BadRequestException('请先接单再交付');
    if (assignment.status >= 3) throw new BadRequestException('该订单已交付');

    await this.prisma.$transaction([
      ...dto.receipts.map(r =>
        this.prisma.deliveryReceipt.create({
          data: { orderId, outletId, type: r.type, url: r.url, remark: r.remark },
        }),
      ),
      this.prisma.orderAssignment.update({
        where: { id: assignment.id },
        data: { status: 3, statusText: '已发货', completedAt: new Date() },
      }),
      this.prisma.sealOrder.update({
        where: { id: orderId },
        data: {
          status: 4,
          statusText: '已发货',
          assignmentStatus: 3,
          deliveryStatus: 1,
          expressCompany: dto.expressCompany,
          expressNo: dto.expressNo,
          deliveredAt: new Date(),
        },
      }),
      this.prisma.outlet.update({
        where: { id: outletId },
        data: { totalOrders: { increment: 1 } },
      }),
    ]);

    return { message: '交付成功，回执已自动展示给客户' };
  }

  /** 客户确认签收 → 订单完成 */
  async signOrder(orderId: string) {
    const order = await this.prisma.sealOrder.findUnique({
      where: { id: orderId },
      include: { assignment: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.deliveryStatus !== 1) throw new BadRequestException('订单未交付，无法签收');

    await this.prisma.$transaction([
      this.prisma.sealOrder.update({
        where: { id: orderId },
        data: { deliveryStatus: 2, status: 5, statusText: '已完成', signedAt: new Date() },
      }),
      ...(order.assignment ? [
        this.prisma.orderAssignment.update({
          where: { id: order.assignment.id },
          data: { status: 4, statusText: '已完成' },
        }),
      ] : []),
    ]);

    return { message: '签收成功' };
  }

  /** 订单交付信息 */
  async getDeliveryInfo(orderId: string) {
    const order = await this.prisma.sealOrder.findUnique({
      where: { id: orderId },
      include: {
        assignment: {
          include: { outlet: { select: { id: true, name: true, contact: true, phone: true } } },
        },
        receipts: { select: { id: true, type: true, url: true, remark: true, createdAt: true } },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');

    return {
      deliveryStatus: order.deliveryStatus,
      deliveredAt: order.deliveredAt,
      signedAt: order.signedAt,
      expressCompany: order.expressCompany,
      expressNo: order.expressNo,
      assignment: order.assignment ? {
        status: order.assignment.status,
        statusText: order.assignment.statusText,
        acceptedAt: order.assignment.acceptedAt,
        completedAt: order.assignment.completedAt,
        Outlet: order.assignment.outlet,
      } : null,
      receipts: order.receipts,
    };
  }

  /** 网点端订单详情（含用户信息、印章明细、快递信息、交付凭证） */
  async getStoreOrderDetail(orderId: string, outletId: string) {
    const assignment = await this.prisma.orderAssignment.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            user: { select: { id: true, nickname: true, phone: true } },
            orderItems: true,
          },
        },
        outlet: { select: { id: true, name: true, contact: true, phone: true, address: true } },
      },
    });

    if (!assignment) throw new NotFoundException('订单分配记录不存在');
    if (assignment.outletId !== outletId) throw new ForbiddenException('无权查看此订单');

    const receipts = await this.prisma.deliveryReceipt.findMany({
      where: { orderId, outletId },
      orderBy: { createdAt: 'desc' },
    });

    const statusMap: Record<number, string> = {
      1: '待接单', 2: '制作中', 3: '已发货', 4: '已完成',
    };

    return {
      orderId: assignment.orderId,
      orderNo: assignment.order.orderNo,
      type: assignment.order.type,
      module: assignment.order.module,
      companyName: assignment.order.companyName,
      contactPhone: assignment.order.contactPhone,
      status: assignment.status,
      statusText: statusMap[assignment.status] ?? assignment.statusText,
      assignedAt: assignment.assignedAt,
      acceptedAt: assignment.acceptedAt,
      completedAt: assignment.completedAt,
      user: assignment.order.user,
      orderItems: assignment.order.orderItems,
      Outlet: assignment.outlet,
      // 快递信息
      expressCompany: assignment.order.expressCompany,
      expressNo: assignment.order.expressNo,
      deliveredAt: assignment.order.deliveredAt,
      signedAt: assignment.order.signedAt,
      deliveryStatus: assignment.order.deliveryStatus,
      // 交付凭证
      receipts,
    };
  }

  // ==================== 工具方法 ====================

  private generateOrderNo(prefix: string): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${dateStr}${random}`;
  }
}
