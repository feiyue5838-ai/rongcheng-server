// @ts-nocheck
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SEAL_PRICE_MAP, getSealPrice } from './seal-prices.constant';
import { WechatService } from '../wechat/wechat.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { generateTransactionNo } from '../../common/utils/sn';
import { v4 as uuidv4 } from 'uuid';

// ==================== 工具函数：snake_case → camelCase ====================
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// ==================== 工具函数：省份名归一化 ====================
const PROVINCE_ALIASES: Record<string, string> = {
  '内蒙古': '内蒙古自治区', '内蒙古自治区': '内蒙古自治区',
  '西藏': '西藏自治区', '西藏自治区': '西藏自治区',
  '广西': '广西壮族自治区', '广西壮族自治区': '广西壮族自治区',
  '宁夏': '宁夏回族自治区', '宁夏回族自治区': '宁夏回族自治区',
  '新疆': '新疆维吾尔自治区', '新疆维吾尔自治区': '新疆维吾尔自治区',
};

function normalizeProvince(p: string): string {
  if (!p) return '';
  const t = p.trim();
  if (t.endsWith('省') || t.endsWith('自治区') || t.endsWith('市') || t.endsWith('特别行政区')) return t;
  if (PROVINCE_ALIASES[t]) return PROVINCE_ALIASES[t];
  if (['北京', '天津', '上海', '重庆', '香港', '澳门', '台湾'].includes(t)) return t + '市';
  return t; // 带"省"字兜底（如"四川省"已在 DB 中，无需加
}

function provincesMatch(addrProv: string, areaProv: string): boolean {
  if (!addrProv || !areaProv) return false;
  return normalizeProvince(addrProv) === normalizeProvince(areaProv);
}

function toCamelDeep(obj: any): any {
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj !== null && typeof obj === 'object') {
    // Prisma Decimal / Buffer 等特殊对象直接转原始值
    if (typeof obj.toString === 'function' && !('getTime' in obj)) {
      const str = obj.toString();
      if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)])
    );
  }
  return obj;
}

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private dispatchService: DispatchService,
    @Inject(forwardRef(() => WechatService)) private wechatService: WechatService,
  ) {}

  // ==================== 创建刻章订单 ====================

  async createSealOrder(user_id: string, dto: any) {
    const {
      type,                   // 模式：company/personal/electronic/query
      company_name,
      seal_reason,
      contact_phone,
      legal_phone,
      license_region,
      license_address_json,  // 执照地区JSON,用于派单匹配
      address_id,
      remark,
      seal_ids,
      package_id,
      items,
      address_json,
    } = dto;

    // ── 边界校验 ───────────────────────────────
    // B1: 明细校验 —— 不再信任前端传入的 price，只校验每项必须有合法的印章/套餐标识
    if (!items || items.length === 0) {
      throw new BadRequestException('订单明细不能为空');
    }
    for (const item of items) {
      const priceKey = item.package_id || item.seal_id;
      if (!priceKey) {
        throw new BadRequestException('订单明细缺少印章或套餐标识');
      }
      if (getSealPrice(priceKey) === null) {
        throw new BadRequestException('包含无效的印章或套餐：' + priceKey);
      }
    }
    // B10: 必填字段
    if (!contact_phone || !String(contact_phone).trim()) {
      throw new BadRequestException('手机号不能为空');
    }
    // 企业刻章模式必须填公司名
    if (type === 'company' && (!company_name || !String(company_name).trim())) {
      throw new BadRequestException('企业刻章必须填写公司名称');
    }
    if (!items || items.length === 0) {
      throw new BadRequestException('订单明细不能为空');
    }

    // 1. 校验地址
    let addressData: any = null;
    if (address_id) {
      addressData = await this.prisma.addresses.findUnique({ where: { id: address_id } });
      if (!addressData) throw new NotFoundException('收货地址不存在');
    } else if (address_json) {
      // 支持直接传入 address_json（小程序端传入）
      try {
        addressData = typeof address_json === 'string' ? JSON.parse(address_json) : address_json;
      } catch {
        addressData = null;
      }
    }
    // 兜底：仍无地址则取用户默认收货地址（确保支付后能自动分配网点）
    if (!addressData) {
      const defaultAddr = await this.prisma.addresses.findFirst({
        where: { user_id, is_default: true },
        orderBy: { created_at: 'desc' },
      });
      if (defaultAddr) addressData = defaultAddr;
    }

    // 2. 计算总价（服务端计价，忽略前端传入的 price，防止抓包篡改金额）
    let total_price = 0;
    const order_items: any[] = [];

    // 从 items 按 seal_id / package_id 查服务端价格表重算总价
    if (items && items.length > 0) {
      for (const item of items) {
        const priceKey = item.package_id || item.seal_id;
        const serverPrice = getSealPrice(priceKey);
        if (serverPrice === null) {
          throw new BadRequestException('无效的印章或套餐：' + priceKey);
        }
        const qty = Number(item.quantity) || 1;
        total_price += serverPrice * qty;
        order_items.push({
          item_type: item.item_type || 'seal',
          seal_id: item.seal_id || null,
          package_id: item.package_id || null,
          name: item.name,
          price: serverPrice, // 用服务端价格，覆盖前端传入 price
          quantity: qty,
          image: item.image || null,
        });
      }
    }

    // 3. 生成订单号
    const order_no = this.generateOrderNo('RC');

    // 4. 创建订单
    const order = await this.prisma.seal_orders.create({
      data: {
        order_no,
        user_id,
        module: 'seal',
        type: type === 'company' ? '企业刻章' : type === 'personal' ? '个人印章' : type === 'electronic' ? '电子印章' : '刻章备案',
        company_name: company_name || null,
        license_region: license_region || null,
        license_address_json: license_address_json || null,
        seal_reason: seal_reason || null,
        contact_phone: contact_phone || null,
        legal_phone: legal_phone || null,
        total_price,
        address_id: address_id || null,
        address_json: addressData ? JSON.stringify(addressData) : null,
        remark: remark || null,
        status: 1,
        status_text: '待支付',
        order_items: {
          create: order_items,
        },
      },
      include: {
        order_items: true,
      },
    });

    // ⚠️ 安全要点：订单创建时一律保持『待支付』，绝不在下单接口里根据前端
    // 传入的 paidStatus 预置已付 / 触发网点分配。支付完成由微信支付回调（或开发
    // 模拟回调）通过 completePayment 统一处理（见下方方法）。前端永远不能自己判定
    // 支付成功。

    // 5. 持久化用户上传的材料（前端已在下单前上传至 /api/upload/user-material 拿到 URL）
    let materialsInput: any = dto.materials;
    if (typeof materialsInput === 'string') {
      try { materialsInput = JSON.parse(materialsInput); } catch { materialsInput = null; }
    }
    if (materialsInput && typeof materialsInput === 'object') {
      const typeMap: Record<string, string> = {
        license: 'license',
        idCardFront: 'id_card_front',
        idCardBack: 'id_card_back',
        legalPhoto: 'photo',
        professionalCert: 'professional_cert',
        signature: 'signature',
        handheldIdPhoto: 'handheld_id',
        additional: 'additional',
      };
      const toCreate: { order_id: string; type: string; url: string }[] = [];
      for (const key of Object.keys(typeMap)) {
        const val = materialsInput[key];
        if (!val) continue;
        if (Array.isArray(val)) {
          for (const u of val) {
            if (typeof u === 'string' && u) toCreate.push({ order_id: order.id, type: typeMap[key], url: u });
          }
        } else if (typeof val === 'string' && val) {
          toCreate.push({ order_id: order.id, type: typeMap[key], url: val });
        }
      }
      if (toCreate.length > 0) {
        await this.prisma.materials.createMany({ data: toCreate });
      }
    }

    return order;
  }

  // ==================== 创建登报订单 ====================

  // 登报 type 白名单（与小程序 categories.js 对齐，防止直接 API 注入脏数据）
  private readonly VALID_NEWSPAPER_TYPES = new Set([
    '身份证挂失', '个人证件', '企业证件', '发票收据', '声明公告',
    '公告声明', '法院公告', '政府送达', '债权债务', '解除劳动',
    '环评公示', '拍卖公告', '登报道歉', '表扬信', '宣传稿', '招标公告',
    // 通用兜底（脏数据或历史订单兼容）
    '登报声明', '个人声明',
  ]);

  /**
   * 安全获取 type 值：白名单之外一律替换为 '登报声明'
   * 防止 UUID/ID/???? 等脏数据写入
   */
  private sanitizeNewspaperType(type: any): string {
    if (typeof type === 'string' && type.length >= 2 && type.length <= 20 && this.VALID_NEWSPAPER_TYPES.has(type)) {
      return type;
    }
    return '登报声明';
  }

  async createNewspaperOrder(user_id: string, dto: any) {
    const { type, content, newspaper_id, templateId, address_id, address_json, remark, price, newspaperName, issueCount, invoice, copyCount, images, section_id, section_name } = dto;

    // 校验/快照地址（与刻章订单保持一致）
    let addressData: any = null;
    if (address_id) {
      addressData = await this.prisma.addresses.findUnique({ where: { id: address_id } });
      if (!addressData) throw new NotFoundException('收货地址不存在');
    } else if (address_json) {
      try { addressData = typeof address_json === 'string' ? JSON.parse(address_json) : address_json; } catch { addressData = null; }
    }
    // 兜底：仍无地址则取用户默认收货地址（确保支付后能自动分配网点）
    if (!addressData) {
      const defaultAddr = await this.prisma.addresses.findFirst({
        where: { user_id, is_default: true },
        orderBy: { created_at: 'desc' },
      });
      if (defaultAddr) addressData = defaultAddr;
    }

    // 服务端权威计价：单价 × max(字数, 最少字数) × 期数（覆盖客户端传入 price，防篡改）
    let serverPrice = Number(price) || 0;
    let sectionId: string | null = section_id || null;
    let sectionName: string | null = section_name || null;
    if (newspaper_id) {
      const np = await this.prisma.newspapers.findUnique({ where: { id: newspaper_id } });
      if (np) {
        const chars = (content || '').length;
        const words = Math.max(chars, np.min_words || 0);
        const copies = Number(copyCount) || 1;
        const ic = Number(issueCount) || 1;
        serverPrice = words * Number(np.price_per_word) * ic * copies;
        if (section_id) {
          const sec = await this.prisma.newspaper_sections.findFirst({
            where: { id: section_id, newspaper_id, status: 1 },
          });
          if (sec) {
            sectionId = sec.id;
            sectionName = sec.name;
            serverPrice += Number(sec.list_price) * ic * copies;
          }
        }
      }
    }

    const safeType = this.sanitizeNewspaperType(type);
    const order_no = this.generateOrderNo('RB');
    const order = await this.prisma.seal_orders.create({
      data: {
        order_no,
        user_id,
        module: 'newspaper',
        type: safeType,
        total_price: serverPrice,
        contact_phone: addressData?.phone || null,
        address_id: address_id || null,
        address_json: addressData ? JSON.stringify(addressData) : null,
        newspaper_content: content || null,
        newspaper_issue_count: issueCount ? Number(issueCount) : null,
        newspaper_images: Array.isArray(images) ? JSON.stringify(images) : null,
        newspaper_copy_count: copyCount ? Number(copyCount) : null,
        newspaper_id: newspaper_id || null,
        newspaper_section_id: sectionId,
        newspaper_section_name: sectionName,
        invoice_json: invoice ? JSON.stringify(invoice) : null,
        remark: remark || null,
        status: 1,
        status_text: '待支付',
        order_items: {
          create: [{
            item_type: 'newspaper',
            name: newspaperName || '报纸登报',
            price: serverPrice,
            quantity: 1,
          }],
        },
      },
      include: { order_items: true },
    });

    return order;
  }

  /** 用户取消订单（仅未支付）已支付订单的退款须由管理员在后台操作 */
  async cancelOrder(order_id: string, user_id: string) {
    const order = await this.prisma.seal_orders.findFirst({ where: { id: order_id, user_id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 1) throw new BadRequestException('当前订单状态不可取消');
    return this.prisma.seal_orders.update({
      where: { id: order_id },
      data: { status: 6, status_text: '已取消' },
    });
  }

  /**
   * 管理员退款（已支付 / 制作中 / 已发货订单）
   * 调用微信退款，成功后将订单置为「已退款」(status=8)。
   * 注：微信退款为异步受理，真实环境应经回调置 8；此处 mock/即时模式下直接置 8。
   */
  /**
   * 管理员发起退款
   * - 状态 2/3/4：直接发起退款（服务未完成）
   * - 状态 7：售后审核通过后发起退款（服务已完成）
   * 发起后置 status=8「退款中」，真实退款以微信异步回调通知更新为 status=9「已退款」。
   */
  async refundOrder(order_id: string, operatorId?: string, amount?: number, reason?: string) {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: order_id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (![2, 3, 4, 7].includes(order.status)) {
      throw new BadRequestException('仅「已支付 / 制作中 / 已发货」或「售后中」订单可发起退款');
    }

    const totalFee = Math.round(Number(order.total_price) * 100);
    const refundFee = amount ? Math.round(Number(amount) * 100) : totalFee;
    if (refundFee <= 0) {
      throw new BadRequestException('退款金额必须大于 0');
    }

    let transaction_id: string | undefined;
    try {
      const r = JSON.parse(order.remark || '{}');
      transaction_id = r.transaction_id;
    } catch { /* ignore */ }

    const wechatRes = await this.wechatService.refundOrder({
      outTradeNo: order.order_no,
      transaction_id,
      totalFee,
      refundFee,
      reason: '客户申请退款',
    });

    // 发起退款后进入「退款中」，真实退款由微信回调更新为「已退款」(9)
    const updated = await this.prisma.seal_orders.update({
      where: { id: order_id },
      data: {
        status: 8,
        status_text: '退款中',
        remark: this.appendRefundRemark(order.remark, {
          refundId: wechatRes.refundId,
          refundFee,
          operatorId,
          refundedAt: new Date().toISOString(),
          reason,
        }),
      },
    });
    return updated;
  }

  private appendRefundRemark(remark: string | null, refund: any): string {
    let obj: any = {};
    try { obj = JSON.parse(remark || '{}'); } catch { obj = {}; }
    obj.refund = refund;
    return JSON.stringify(obj);
  }

  // ==================== 订单列表（用户端） ====================

  async getMyOrders(user_id: string, query: any) {
    const { page = 1, pageSize = 10, module, status } = query;
    const where: any = { user_id };
    if (module) where.module = module;
    if (status) where.status = Number(status);

    const [orders, total] = await Promise.all([
      this.prisma.seal_orders.findMany({
        where,
        include: {
          order_items: { include: { seal: true } },
          reviews: true,
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.seal_orders.count({ where }),
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

  async getOrderDetail(order_id: string, user_id?: string) {
    const where: any = { id: order_id };
    if (user_id) where.user_id = user_id;

    const order = await this.prisma.seal_orders.findFirst({
      where,
      include: {
        user: { select: { id: true, nickname: true, phone: true } },
        order_items: { include: { seal: true, package: true } },
        materials: true,
        reviews: { include: { user: { select: { nickname: true, avatar: true } } } },
        assignment: { include: { outlet: { select: { id: true, name: true, phone: true, service_area: true } } } },
        delivery_receipts: true,
      },
    });

    if (!order) throw new NotFoundException('订单不存在');

    // Prisma 返回 snake_case → 统一转为 camelCase
    return toCamelDeep(order);
  }

  // ==================== 微信支付 ====================

  async createPayOrder(order_id: string, user_id: string, openid: string) {
    const order = await this.prisma.seal_orders.findFirst({
      where: { id: order_id, user_id },
    });

    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 1) throw new BadRequestException('订单状态不允许支付');

    // 价格为 0：直接完成支付（仍走统一入口，自动分配网点）
    if (Number(order.total_price) === 0) {
      await this.completePayment({ id: order_id }, { pay_method: 'free' });
      return { type: 'free', order_id };
    }

    // 微信支付未配置（开发环境）：返回 dev 类型，由前端调用 dev-paid 模拟回调
    if (!this.wechatService.isPayConfigured()) {
      return { type: 'dev', order_id };
    }

    // 调用微信支付（统一下单）
    const payResult = await this.wechatService.createUnifiedOrder({
      outTradeNo: order.order_no,
      totalFee: Math.round(Number(order.total_price) * 100), // 转为分
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
    orderKey: { order_no?: string; id?: string },
    pay: { pay_method: string; transaction_id?: string },
  ) {
    const where: any = orderKey.order_no ? { order_no: orderKey.order_no } : { id: orderKey.id };
    const order = await this.prisma.seal_orders.findFirst({ where });
    if (!order) throw new NotFoundException('订单不存在');

    // 幂等：微信可能重复推送回调，已支付则直接返回，避免重复分配
    if (order.status >= 2) return order;

    await this.prisma.seal_orders.update({
      where: { id: order.id },
      data: {
        status: 2,
        status_text: '已支付',
        // 修复：支付完成时记录实付金额，否则 pay_price 永久为 null，
        // 导致营收统计（sum pay_price）严重低估且订单详情缺实付金额
        pay_price: order.total_price,
        pay_time: new Date(),
        pay_method: pay.pay_method,
        transaction_id: pay.transaction_id || null,
      },
    });

    // 支付成功后触发全国网点自动分配（仅未分配时）
    // 根据订单类型选择派单地址：企业刻章用执照地区，个人印章用收货地址
    const addressForDispatch = order.type === '个人印章' ? order.address_json : order.license_address_json;
    
    if ((order.assignment_status === 0 || order.assignment_status == null) && addressForDispatch) {
      const assignResult = await this.dispatchService.smartAssign(addressForDispatch, order.module || 'seal', 'system');
      if (assignResult) {
        await this.prisma.order_assignments.create({
          data: {
            order_id: order.id,
            outlet_id: assignResult.outlet_id,
            status: 1,
            status_text: '待接单',
            assigned_by: 'system',
            remark: `系统自动分配 → ${assignResult.storeName}`,
          },
        });
        await this.prisma.seal_orders.update({
          where: { id: order.id },
          data: { assignment_status: 1 },
        });

        // ============ 新单通知（站内 + 订阅消息） ============
        const orderTypeDesc = order.module === 'newspaper'
          ? `登报-${order.type || '声明'}`
          : `刻章-${order.type || '印章'}`;
        const notifyContent = `订单 ${order.order_no} 已分配到 ${assignResult.storeName}，请尽快接单处理`;

        // 1. 站内通知
        await this.prisma.outlet_notifications.create({
          data: {
            outlet_id: assignResult.outlet_id,
            title: '新订单待接单',
            content: notifyContent,
            type: 'order',
            order_id: order.id,
            order_no: order.order_no,
            is_read: false,
          },
        });

        // 2. 微信订阅消息（网点负责人 openid）— 不阻断主流程
        const outlet = await this.prisma.outlets.findUnique({
          where: { id: assignResult.outlet_id },
          select: { outlet_openid: true, name: true, subscribe_msg: true },
        });
        if (outlet?.outlet_openid && outlet.subscribe_msg !== 0) {
          try {
            await this.wechatService.sendNewOrderSubscribeMessage(
              outlet.outlet_openid,
              order.order_no,
              orderTypeDesc,
              assignResult.storeName,
            );
          } catch (e) {
            // 订阅消息失败不影响分配流程，仅记录
            console.warn(`[notify] 订阅消息发送失败 order_no=${order.order_no}:`, e.message);
          }
        }
      }
    }

    // 返回完整订单数据（含 assignment、receipts 等）

    // ============ [payflow] 支付成功自动写入交易流水 ============
    const now = new Date();
    try {
      // 幂等：防止极端并发下重复写入（completePayment 本身有 status>=2 提前返回保护）
      const existFlow = await this.prisma.transaction_flows.findFirst({
        where: { order_id: order.id, trade_type: 'income' },
      });
      if (!existFlow) {
        // 查询网点（可能本次刚分配，也可能是历史已有派单）
        let outletId = null;
        let outletName = null;
        const assign = await this.prisma.order_assignments.findFirst({
          where: { order_id: order.id },
          include: { outlet: { select: { id: true, name: true } } },
        });
        if (assign && assign.outlet) {
          outletId = assign.outlet.id;
          outletName = assign.outlet.name;
        }
        // 用户冗余信息
        let userName = null;
        let userPhone = null;
        if (order.user_id) {
          const u = await this.prisma.users.findUnique({
            where: { id: order.user_id },
            select: { nickname: true, phone: true },
          });
          if (u) { userName = u.nickname; userPhone = u.phone; }
        }
        const tno = generateTransactionNo();
        const amount = Number(order.total_price);
        const fee = Math.round(amount * 0.006 * 100) / 100; // 渠道费率 0.6%
        const typeMap = { seal: '刻章', newspaper: '登报', bookkeeping: '代理记账' };
        await this.prisma.transaction_flows.create({
          data: {
            transaction_no: tno,
            order_id: order.id,
            order_no: order.order_no,
            module: order.module || 'seal',
            business_type: typeMap[order.module] || order.module || '刻章',
            trade_type: 'income',
            user_id: order.user_id || null,
            user_name: userName,
            user_phone: userPhone,
            outlet_id: outletId,
            outlet_name: outletName,
            amount: amount,
            fee: fee,
            net_amount: Math.round((amount - fee) * 100) / 100,
            pay_method: pay.pay_method,
            status: 'success',
            status_text: '交易成功',
            transaction_id: pay.transaction_id || null,
            created_at: now,
          },
        });
      }
    } catch (e) {
      // 流水写入失败不影响支付主流程，记录日志便于人工补录
      console.error('[payflow] 交易流水写入失败 order_no=' + order.order_no + ':', e.message);
    }

    return this.prisma.seal_orders.findFirst({
      where: { id: order.id },
      include: {
        user: { select: { id: true, nickname: true, phone: true } },
        order_items: { include: { seal: true } },
        assignment: {
          include: {
            outlet: { select: { id: true, name: true, phone: true, address: true } },
          },
        },
        delivery_receipts: {
          include: { outlet: { select: { id: true, name: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  /**
   * 开发环境模拟支付成功：仅当 NODE_ENV !== 'production' 可用。
   * 用于本地无真实商户号时模拟微信回调。生产环境调用会抛 403。
   */
  async devConfirmPaid(order_id: string, user_id: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('生产环境不允许模拟支付');
    }
    const order = await this.prisma.seal_orders.findFirst({ where: { id: order_id, user_id } });
    if (!order) throw new NotFoundException('订单不存在');
    return this.completePayment({ id: order_id }, { pay_method: 'dev' });
  }

  // ==================== 管理端：订单列表 ====================

  async adminGetOrders(query: any) {
    const { page = 1, pageSize = 20, module, status, keyword, startDate, endDate } = query;
    const where: any = {};

    if (module) where.module = module;
    if (status) where.status = Number(status);
    if (keyword) {
      where.OR = [
        { order_no: { contains: keyword } },
        { company_name: { contains: keyword } },
        { contact_phone: { contains: keyword } },
      ];
    }
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      this.prisma.seal_orders.findMany({
        where,
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
          order_items: { include: { seal: true } },
          assignment: { include: { outlet: { select: { id: true, name: true } } } },
          delivery_receipts: true,
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: Number(pageSize),
      }),
      this.prisma.seal_orders.count({ where }),
    ]);

    return {
      list: orders.map(o => toCamelDeep({
        id: o.id,
        orderNo: o.order_no,
        module: o.module,
        type: o.type,
        companyName: o.company_name,
        contactPhone: o.contact_phone,
        totalPrice: Number(o.total_price) || 0,
        payPrice: Number(o.pay_price) || 0,
        status: o.status,
        statusText: o.status_text,
        payTime: o.pay_time,
        createdAt: o.created_at,
        user: o.user,
        orderItems: toCamelDeep(o.order_items),
        assignmentStatus: o.assignment_status,
        assignment: o.assignment ? (() => {
          const map: Record<number, string> = { 0: '待接单', 1: '已接单', 2: '制作中', 3: '已发货', 4: '已完成', 5: '已拒绝' };
          const camel = toCamelDeep(o.assignment);
          const outletName = o.assignment.outlet?.name ?? null;
          return { ...camel, statusText: map[o.assignment.status] ?? o.assignment.status_text, outletName };
        })() : null,
        receipts: toCamelDeep(o.delivery_receipts),
        // 登报字段
        newspaperContent: o.newspaper_content,
        newspaperIssueCount: o.newspaper_issue_count,
        newspaperCopyCount: o.newspaper_copy_count,
        newspaperImages: (() => { try { return JSON.parse(o.newspaper_images || '[]'); } catch { return []; } })(),
        extra: o.module === 'bookkeeping' ? (() => {
          try {
            const r = typeof o.remark === 'string' ? JSON.parse(o.remark || '{}') : (o.remark || {});
            return { taxpayerType: r.taxpayer_type, cycle: r.cycle, invoice: r.invoice, social: r.social, fund: r.fund };
          } catch (e) { return undefined; }
        })() : undefined,
      })),
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    };
  }

  // ==================== 管理端：材料审核 ====================

  async auditMaterial(materialId: string, status: number, remark: string | undefined, admin_id: string) {
    if (![1, 2].includes(status)) throw new BadRequestException('审核状态仅支持 1=通过 2=驳回');
    const m = await this.prisma.materials.findUnique({ where: { id: materialId } });
    if (!m) throw new NotFoundException('材料不存在');
    if (m.status !== 0) throw new BadRequestException('该材料已审核，无需重复操作');

    const updated = await this.prisma.materials.update({
      where: { id: materialId },
      data: { status, remark: remark || null },
    });

    // 全部审核完毕后,推送通知
    const order = await this.prisma.seal_orders.findUnique({
      where: { id: m.order_id },
      include: { materials: true, assignment: true },
    });
    if (order) {
      const allDone = order.materials.every(x => x.id === materialId ? status !== 0 : x.status !== 0);
      if (allDone && order.assignment?.outlet_id) {
        await this.prisma.outlet_notifications.create({
          data: {
            outlet_id: order.assignment.outlet_id,
            title: '材料审核完成',
            content: `订单 ${order.order_no} 材料审核完成，请确认后开始制作`,
            type: 'material',
            order_id: order.id,
            order_no: order.order_no,
            is_read: false,
          },
        });
      }
    }
    return updated;
  }

  // ==================== 管理端：更新订单状态 ====================

  async adminUpdateOrder(order_id: string, dto: any, admin_id: string) {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: order_id } });
    if (!order) throw new NotFoundException('订单不存在');

    // B5: 状态值范围校验
    const VALID_STATUSES = [1, 2, 3, 4, 5, 6, 7, 8];
    if (dto.status !== undefined && !VALID_STATUSES.includes(Number(dto.status))) {
      throw new BadRequestException('无效的订单状态，合法值：1-待支付 2-已支付 3-制作中 4-已发货 5-已完成 6-已取消 7-退款中 8-已退款');
    }

    // B6: 状态机约束 — 防止管理员随意跳状态（如未付款改已完成）
    const TERMINAL_STATUSES = [5, 6, 7, 8];
    if (dto.status !== undefined) {
      const from = order.status;
      const to = Number(dto.status);
      if (TERMINAL_STATUSES.includes(from)) {
        throw new BadRequestException(`订单已在终态（${from}），无法变更状态`);
      }
      // 合法的状态跳转：正向递增 或 特定逆向（1→6取消 / 2,3,4→7/8退款 / 任意→5完成须已付款）
      const validTransitions: Record<number, number[]> = {
        1: [2, 5, 6],
        2: [3, 4, 5, 7, 8],
        3: [4, 5, 7, 8],
        4: [5, 7, 8],
      };
      const allowed = validTransitions[from] || [];
      if (!allowed.includes(to)) {
        throw new BadRequestException(`状态 ${from}→${to} 非法。允许：1→2/5/6，2→3/4/5/7/8，3→4/5/7/8，4→5/7/8`);
      }
      // 完成订单（终态5）须已付款
      if (to === 5 && from < 2) {
        throw new BadRequestException('未付款订单不能标记为已完成');
      }
    }

    const statusMap: Record<number, string> = {
      1: '待支付', 2: '已支付', 3: '制作中', 4: '已发货',
      5: '已完成', 6: '已取消', 7: '退款中', 8: '已退款',
    };

    // Fix: 使用 { ...order, ...dto } 而非 { ...dto }
    // 避免 dto 未传入 remark 时，{ ...dto } 会产生 remark: undefined，Prisma 将 DB remark 覆盖为 null
    const updateData: any = { ...order, ...dto };
    if (dto.status !== undefined) {
      updateData.status_text = statusMap[dto.status] || '未知状态';
      // 状态变更为已支付及以上时,补齐 pay_time/pay_price,避免影响营收统计与趋势图
      if (dto.status >= 2 && order.status < 2) {
        if (!order.pay_time) updateData.pay_time = new Date();
        if (order.pay_price == null || Number(order.pay_price) === 0) {
          updateData.pay_price = order.total_price;
        }
      }
    }

    // Fix: 管理员改状态为"已支付"时，自动触发网点分配（与 completePayment 逻辑对齐）
    const isPaid = dto.status !== undefined && dto.status >= 2;
    // 根据订单类型选择派单地址：企业刻章用执照地区，个人印章用收货地址
    const addressForDispatch = order.type === '个人印章' ? order.address_json : order.license_address_json;
    const needsAssign = isPaid && (order.assignment_status === 0 || order.assignment_status == null) && addressForDispatch;

    if (needsAssign) {
      const assignResult = await this.dispatchService.smartAssign(addressForDispatch, order.module || 'seal', admin_id);
      if (assignResult) {
        await this.prisma.order_assignments.create({
          data: {
            order_id: order.id,
            outlet_id: assignResult.outlet_id,
            status: 1,
            status_text: '待接单',
            assigned_by: admin_id,
            remark: `管理员改状态时自动分配 → ${assignResult.storeName}`,
          },
        });
        updateData.assignment_status = 1;

        // 站内通知
        await this.prisma.outlet_notifications.create({
          data: {
            outlet_id: assignResult.outlet_id,
            title: '新订单待接单',
            content: `订单 ${order.order_no} 已由管理员标记为已支付并分配到 ${assignResult.storeName}，请尽快接单处理`,
            type: 'order',
            order_id: order.id,
            order_no: order.order_no,
            is_read: false,
          },
        });

        // 订阅消息 — 不阻断
        const outlet = await this.prisma.outlets.findUnique({
          where: { id: assignResult.outlet_id },
          select: { outlet_openid: true, subscribe_msg: true },
        });
        if (outlet?.outlet_openid && outlet.subscribe_msg !== 0) {
          try {
            await this.wechatService.sendNewOrderSubscribeMessage(
              outlet.outlet_openid, order.order_no,
              order.module === 'newspaper' ? `登报-${order.type || '声明'}` : `刻章-${order.type || '印章'}`,
              assignResult.storeName,
            );
          } catch (e) {
            console.warn(`[notify] 订阅消息发送失败 order_no=${order.order_no}:`, e.message);
          }
        }
      }
    }

    updateData.processed_by = admin_id;
    updateData.processed_at = new Date();

    return this.prisma.seal_orders.update({
      where: { id: order_id },
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

    const [
      totalOrders,
      todayOrders,
      pending,
      assigned,
      pendingSeal,
      pendingNewspaper,
      pendingBookkeeping,
      sealTotal,
      newspaperTotal,
      bookkeepingTotal,
      sealRev,
      newspaperRev,
      bookkeepingRev,
      making,
      todaySeal,
      todayNewspaper,
      todayBookkeeping,
      afterSalesTotal,
      afterSalesPending,
      afterSalesRefunding,
      afterSalesToday,
    ] = await Promise.all([
      this.prisma.seal_orders.count(),
      this.prisma.seal_orders.count({ where: { created_at: { gte: shanghaiStart } } }),
      // 待分配：未分配且已支付/制作中（status in [2,3]）
      this.prisma.seal_orders.count({ where: { assignment_status: 0, status: { in: [2, 3] } } }),
      // 已分配：assignment_status > 0
      this.prisma.seal_orders.count({ where: { assignment_status: { gt: 0 } } }),
      // 待分配按模块拆分
      this.prisma.seal_orders.count({ where: { module: 'seal', assignment_status: 0, status: { in: [2, 3] } } }),
      this.prisma.seal_orders.count({ where: { module: 'newspaper', assignment_status: 0, status: { in: [2, 3] } } }),
      this.prisma.seal_orders.count({ where: { module: 'bookkeeping', assignment_status: 0, status: { in: [2, 3] } } }),
      // 各模块订单总数（用于统计卡）
      this.prisma.seal_orders.count({ where: { module: 'seal' } }),
      this.prisma.seal_orders.count({ where: { module: 'newspaper' } }),
      this.prisma.seal_orders.count({ where: { module: 'bookkeeping' } }),
      // 收入：刻章/代理记账用 pay_price，登报用 total_price
      this.prisma.seal_orders.aggregate({ where: { module: 'seal', status: { gte: 2 } }, _sum: { pay_price: true } }),
      this.prisma.seal_orders.aggregate({ where: { module: 'newspaper', status: { gte: 2 } }, _sum: { total_price: true } }),
      this.prisma.seal_orders.aggregate({ where: { module: 'bookkeeping', status: { gte: 2 } }, _sum: { pay_price: true } }),
      // 制作中：网点已接单（assignment.status = 2）
      this.prisma.order_assignments.count({ where: { status: 2 } }),
      // 今日刻章新增
      this.prisma.seal_orders.count({ where: { module: 'seal', created_at: { gte: shanghaiStart } } }),
      // 今日登报/代理记账新增
      this.prisma.seal_orders.count({ where: { module: 'newspaper', created_at: { gte: shanghaiStart } } }),
      this.prisma.seal_orders.count({ where: { module: 'bookkeeping', created_at: { gte: shanghaiStart } } }),
      // 售后统计：status 7=售后中 8=退款中 9=已退款
      this.prisma.seal_orders.count({ where: { status: { in: [7, 8, 9] } } }),
      this.prisma.seal_orders.count({ where: { status: 7 } }),
      this.prisma.seal_orders.count({ where: { status: 8 } }),
      this.prisma.seal_orders.count({ where: { status: { in: [7, 8, 9] }, created_at: { gte: shanghaiStart } } }),
    ]);

    return {
      totalOrders,
      todayOrders,
      pendingOrders: pending,
      assignedOrders: assigned,
      pendingSeal,
      pendingNewspaper,
      pendingBookkeeping,
      seal: sealTotal,
      newspaper: newspaperTotal,
      bookkeeping: bookkeepingTotal,
      totalRevenue:
        Number(sealRev._sum.pay_price || 0) +
        Number(newspaperRev._sum?.total_price || 0) +
        Number(bookkeepingRev._sum.pay_price || 0),
      making,
      todaySeal,
      todayNewspaper,
      todayBookkeeping,
      afterSalesTotal,
      afterSalesPending,
      afterSalesRefunding,
      afterSalesToday,
    };
  }

  // ==================== 订单分配与交付 ====================

  /** 待分配订单列表 */
  async getUnassignedOrders(params: { page: number; pageSize: number; module?: string; keyword?: string }) {
    const { page, pageSize, module, keyword } = params;
    const where: any = { assignment_status: 0, status: { in: [2, 3] } };
    if (module) where.module = module;
    if (keyword) {
      where.OR = [
        { order_no: { contains: keyword } },
        { company_name: { contains: keyword } },
        { contact_phone: { contains: keyword } },
      ];
    }

    const [list, total, allOutlets] = await Promise.all([
      this.prisma.seal_orders.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
          order_items: true,
          assignment: {
            include: { outlet: { select: { id: true, name: true, phone: true } } },
          },
          delivery_receipts: true,
        },
      }),
      this.prisma.seal_orders.count({ where }),
      this.prisma.outlets.findMany({ where: { status: 1 }, select: { id: true, name: true, service_area: true, province: true, city: true } }),
    ]);

    // 批量查询用户默认地址（兜底：没有默认则取最新地址）
    const userIds = [...new Set(list.map(o => o.user_id).filter(Boolean))];
    const allAddrs = await this.prisma.addresses.findMany({
      where: { user_id: { in: userIds } },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
    // 每个用户取第一条（优先默认，其次最新）
    const addrMap = new Map<string, typeof allAddrs[0]>();
    for (const a of allAddrs) {
      if (!addrMap.has(a.user_id)) addrMap.set(a.user_id, a);
    }

    return {
      list: list.map(o => {
        const addr = addrMap.get(o.user_id);
        const serviceRegion = addr ? `${addr.province || ''}${addr.city || ''}${addr.district || ''}` : '';
        // 匹配推荐网点
        const recommendedOutlets = allOutlets.filter(outlet => {
          if (!addr?.province) return false;
          try {
            const areas = JSON.parse(outlet.service_area || '[]');
            for (const area of areas) {
              if (provincesMatch(addr.province, area.province)) {
                if (!area.city) return true; // 全省通办
                if (addr.city?.includes(area.city) || area.city?.includes(addr.city)) return true;
              }
            }
          } catch { /* ignore */ }
          return false;
        }).map(o => ({ id: o.id, name: o.name, province: o.province, city: o.city }));

        return toCamelDeep({
          id: o.id,
          orderNo: o.order_no,
          module: o.module,
          type: o.type,
          companyName: o.company_name,
          contactPhone: o.contact_phone,
          totalPrice: Number(o.total_price) || 0,
          payPrice: Number(o.pay_price) || 0,
          status: o.status,
          statusText: o.status_text,
          payTime: o.pay_time,
          createdAt: o.created_at,
          user: o.user,
          orderItems: o.order_items,
          assignmentStatus: o.assignment_status,
          assignment: o.assignment,
          receipts: o.delivery_receipts,
          serviceRegion,
          recommendedOutlets,
          // 客户完整地址信息
          customerAddress: addr ? {
            contact: addr.contact,
            phone: addr.phone,
            province: addr.province,
            city: addr.city,
            district: addr.district,
            detail: addr.detail,
            fullAddress: `${addr.province || ''}${addr.city || ''}${addr.district || ''}${addr.detail || ''}`,
          } : null,
        });
      }),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /** 已分配订单列表 */
  async getAssignedOrders(params: { page: number; pageSize: number; module?: string; keyword?: string }) {
    const { page, pageSize, module, keyword } = params;
    const where: any = { assignment_status: { in: [1, 2, 3] }, status: { in: [2, 3] } };
    if (module) where.module = module;
    if (keyword) {
      where.OR = [
        { order_no: { contains: keyword } },
        { company_name: { contains: keyword } },
        { contact_phone: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.seal_orders.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
          order_items: true,
          assignment: {
            include: { outlet: { select: { id: true, name: true, phone: true, city: true } } },
          },
          delivery_receipts: true,
        },
      }),
      this.prisma.seal_orders.count({ where }),
    ]);

    return {
      list: list.map(o => toCamelDeep({
        id: o.id,
        orderNo: o.order_no,
        module: o.module,
        type: o.type,
        companyName: o.company_name,
        contactPhone: o.contact_phone,
        totalPrice: Number(o.total_price) || 0,
        payPrice: Number(o.pay_price) || 0,
        status: o.status,
        statusText: o.status_text,
        payTime: o.pay_time,
        createdAt: o.created_at,
        user: o.user,
        orderItems: o.order_items,
        assignmentStatus: o.assignment_status,
        assignment: o.assignment,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /** 分配订单给网点 */
  async assignOrder(order_id: string, outlet_id: string, remark: string | undefined, admin_id: string) {
    const order = await this.prisma.seal_orders.findUnique({ where: { id: order_id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status < 2) throw new BadRequestException('订单未支付，无法分配');
    if (order.assignment_status > 0) throw new BadRequestException('订单已分配，请勿重复分配');

    const Outlet = await this.prisma.outlets.findFirst({ where: { id: outlet_id } });
    if (!Outlet) throw new NotFoundException('网点不存在或 ID 无效');
    if (Outlet.status === 0) throw new BadRequestException('网点已被禁用');

    await this.prisma.$transaction([
      this.prisma.order_assignments.create({
        data: {
          order_id,
          outlet_id,
          status: 1,
          status_text: '待接单',
          assigned_by: admin_id,
          remark,
        },
      }),
      this.prisma.seal_orders.update({
        where: { id: order_id },
        data: { assignment_status: 1 },
      }),
    ]);

    return { message: '分配成功' };
  }

  /** 网点接单 */
  async acceptOrder(id: string, outlet_id: string) {
    // 前端传的是 order_assignments.id，直接查分配记录
    const assignment = await this.prisma.order_assignments.findUnique({
      where: { id },
    });
    if (!assignment) throw new NotFoundException('订单分配记录不存在');
    // 取实际的 order_id
    const order_id = assignment.order_id;
    if (assignment.outlet_id !== outlet_id) throw new BadRequestException('无权操作此订单');
    if (assignment.status === 2) throw new BadRequestException('该订单已接单');
    if (assignment.status === 3) throw new BadRequestException('该订单已交付');

    await this.prisma.$transaction([
      this.prisma.order_assignments.update({
        where: { id: assignment.id },
        data: { status: 2, status_text: '制作中', accepted_at: new Date() },
      }),
      this.prisma.seal_orders.update({
        where: { id: order_id },
        data: { assignment_status: 2, status_text: '制作中' },
      }),
    ]);

    return { message: '接单成功' };
  }

  /** 网点提交交付（自动生效） */
  async deliverOrder(id: string, dto: { express_company: string; express_no: string; receipts: Array<{ type: string; url: string; remark?: string }>; sealImages?: Array<{ url: string; remark?: string }>; remark?: string }, outlet_id: string) {
    // 前端传的是 order_assignments.id
    const assignment = await this.prisma.order_assignments.findUnique({
      where: { id },
      include: { seal_orders: true },
    });
    if (!assignment) throw new NotFoundException('订单分配记录不存在');
    const order_id = assignment.order_id;
    if (assignment.outlet_id !== outlet_id) throw new BadRequestException('无权操作此订单');
    if (assignment.status === 1) throw new BadRequestException('请先接单再交付');
    if (assignment.status >= 3) throw new BadRequestException('该订单已交付');

    await this.prisma.$transaction([
      ...dto.receipts.map(r =>
        this.prisma.delivery_receipts.create({
          data: { order_id, outlet_id, type: r.type || 'certificate', url: r.url, remark: r.remark },
        }),
      ),
      ...(dto.sealImages || []).map(img =>
        this.prisma.delivery_receipts.create({
          data: { order_id, outlet_id, type: 'seal', url: img.url, remark: img.remark || null },
        }),
      ),
      this.prisma.order_assignments.update({
        where: { id: assignment.id },
        data: { status: 4, status_text: '已完成', completed_at: new Date() },
      }),
      this.prisma.seal_orders.update({
        where: { id: order_id },
        data: {
          status: 4,
          status_text: '已完成',
          assignment_status: 4,
          delivery_status: 1,
          express_company: dto.expressCompany,
          express_no: dto.expressNo,
          delivered_at: new Date(),
        },
      }),
      this.prisma.outlets.update({
        where: { id: outlet_id },
        data: { total_orders: { increment: 1 } },
      }),
    ]);

    return { message: '交付成功，回执已自动展示给客户' };
  }

  /** 客户确认签收 → 订单完成 */
  async signOrder(order_id: string) {
    const order = await this.prisma.seal_orders.findUnique({
      where: { id: order_id },
      include: { assignment: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.delivery_status !== 1) throw new BadRequestException('订单未交付，无法签收');

    await this.prisma.$transaction([
      this.prisma.seal_orders.update({
        where: { id: order_id },
        data: { delivery_status: 2, status: 5, status_text: '已完成', signed_at: new Date() },
      }),
      ...(order.assignment ? [
        this.prisma.order_assignments.update({
          where: { id: order.assignment.id },
          data: { status: 4, status_text: '已完成' },
        }),
      ] : []),
    ]);

    return { message: '签收成功' };
  }

  /** 订单交付信息 */
  async getDeliveryInfo(order_id: string) {
    const order = await this.prisma.seal_orders.findUnique({
      where: { id: order_id },
      include: {
        assignment: {
          include: { outlet: { select: { id: true, name: true, contact: true, phone: true } } },
        },
        delivery_receipts: { select: { id: true, type: true, url: true, remark: true, created_at: true } },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');

    return {
      delivery_status: order.delivery_status,
      delivered_at: order.delivered_at,
      signed_at: order.signed_at,
      express_company: order.express_company,
      express_no: order.express_no,
      assignment: order.assignment ? {
        status: order.assignment.status,
        status_text: order.assignment.status_text,
        accepted_at: order.assignment.accepted_at,
        completed_at: order.assignment.completed_at,
        Outlet: order.assignment.outlet,
      } : null,
      receipts: order.delivery_receipts,
    };
  }

  /** 网点端订单详情（含用户信息、印章明细、快递信息、交付凭证） */
  async getStoreOrderDetail(order_id: string, outlet_id: string) {
    const assignment = await this.prisma.order_assignments.findUnique({
      where: { order_id },
      include: {
        seal_orders: {
          include: {
            user: { select: { id: true, nickname: true, phone: true } },
            order_items: true,
            materials: true,
          },
        },
        outlet: { select: { id: true, name: true, contact: true, phone: true, address: true } },
      },
    });

    if (!assignment) throw new NotFoundException('订单分配记录不存在');
    if (assignment.outlet_id !== outlet_id) throw new ForbiddenException('无权查看此订单');

    const receipts = await this.prisma.delivery_receipts.findMany({
      where: { order_id, outlet_id },
      orderBy: { created_at: 'desc' },
    });

    const statusMap: Record<number, string> = {
      1: '待接单', 2: '制作中', 3: '已发货', 4: '已完成',
    };

    return {
      order_id: assignment.order_id,
      order_no: assignment.order.order_no,
      type: assignment.order.type,
      module: assignment.order.module,
      company_name: assignment.order.company_name,
      contact_phone: assignment.order.contact_phone,
      status: assignment.status,
      status_text: statusMap[assignment.status] ?? assignment.status_text,
      assigned_at: assignment.assigned_at,
      accepted_at: assignment.accepted_at,
      completed_at: assignment.completed_at,
      user: assignment.order.user,
      order_items: assignment.order.order_items,
      Outlet: assignment.outlet,
      // 快递信息
      express_company: assignment.order.express_company,
      express_no: assignment.order.express_no,
      delivered_at: assignment.order.delivered_at,
      signed_at: assignment.order.signed_at,
      delivery_status: assignment.order.delivery_status,
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
