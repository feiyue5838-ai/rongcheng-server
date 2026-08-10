import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderService } from '../order/order.service';
import axios from 'axios';
// import { v2 as wavepay } from 'wechatpay-nodejs-sdk';
import * as crypto from 'crypto';

@Injectable()
export class WechatService {
  private appId: string;
  private appSecret: string;
  private mchId: string;
  private mchKey: string;
  private privateKey: string;
  private certificate: string;
  private apiV3Key: string;
  private serialNo: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderService)) private orderService: OrderService,
  ) {
    this.appId = this.config.get<string>('WECHAT_APP_ID') || '';
    this.appSecret = this.config.get<string>('WECHAT_APP_SECRET') || '';
    // W-05/W-04: 修正 env 变量名（.env 中使用 WECHAT_PAY_* 前缀）
    this.mchId = this.config.get<string>('WECHAT_PAY_MCHID') || '';
    this.mchKey = this.config.get<string>('WECHAT_PAY_APIV3_KEY') || '';
    this.privateKey = this.config.get<string>('WECHAT_PAY_PRIVATE_KEY') || '';
    this.certificate = this.config.get<string>('WECHAT_PAY_CERTIFICATE') || '';
    this.apiV3Key = this.config.get<string>('WECHAT_PAY_APIV3_KEY') || '';
    this.serialNo = this.config.get<string>('WECHAT_PAY_SERIAL_NO') || '';
  }

  // ==================== 小程序登录 ====================

  /**
   * 通过 code 获取 openid
   */
  async getOpenidByCode(code: string): Promise<string | null> {
    if (!this.appId || !this.appSecret) {
      return `mock_openid_${code}`;
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${this.appId}&secret=${this.appSecret}&js_code=${code}&grant_type=authorization_code`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.errcode) {
      console.error('微信登录失败:', data);
      return null;
    }

    return data.openid;
  }

  /**
   * 获取用户手机号
   */
  async getPhoneNumber(code: string): Promise<string | null> {
    if (!this.appId || !this.appSecret) {
      return '13800138000';
    }

    const accessToken = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
    const response = await axios.post(url, { code });
    const data = response.data;

    if (data.errcode !== 0) {
      console.error('获取手机号失败:', data);
      return null;
    }

    return data.phone_info.phoneNumber;
  }

  /**
   * 获取 Access Token（服务端用）
   */
  async getAccessToken(): Promise<string> {
    if (!this.appId || !this.appSecret) {
      return 'mock_access_token';
    }

    const cached = (global as any).__wxAccessToken;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.access_token) {
      (global as any).__wxAccessToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 200) * 1000,
      };
      return data.access_token;
    }

    throw new BadRequestException('获取 AccessToken 失败');
  }

  // ==================== 订阅消息（网点新单通知） ====================

  /**
   * 发送订阅消息给网点负责人
   * @param openid 网点负责人微信 openid
   * @param order_no 订单号
   * @param orderType 订单类型描述（如 "刻章-公司印章"）
   * @param outletName 分配到的网点名称
   */
  async sendNewOrderSubscribeMessage(
    openid: string,
    order_no: string,
    orderType: string,
    outletName: string,
  ): Promise<void> {
    const templateId = this.config.get<string>('WECHAT_SUBSCRIBE_TEMPLATE_ID');
    if (!openid || !templateId) return;
    if (!this.appId || !this.appSecret) return;

    try {
      const accessToken = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
      const response = await axios.post(url, {
        touser: openid,
        template_id: templateId,
        page: 'pages/notification/index',
        data: {
          thing1: { value: '您有一笔新订单待处理' },
          character_string2: { value: order_no },
          thing3: { value: orderType.slice(0, 20) },
          thing4: { value: outletName.slice(0, 20) },
        },
      });
      if (response.data.errcode !== 0) {
        console.error('订阅消息发送失败:', response.data);
      }
    } catch (error) {
      console.error('订阅消息发送异常:', error.message);
    }
  }

  // ==================== 微信支付 ====================

  /**
   * 创建统一下单
   */
  async createUnifiedOrder(params: {
    outTradeNo: string;
    totalFee: number; // 单位：分
    body: string;
    openid: string;
    notifyUrl: string;
  }): Promise<any> {
    if (!this.mchId || !this.mchKey) {
      return {
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: crypto.randomBytes(16).toString('hex'),
        package: 'prepay_id=mock_prepay_id',
        signType: 'MD5',
        paySign: 'mock_pay_sign',
      };
    }

    const { outTradeNo, totalFee, body, openid, notifyUrl } = params;

    // V3 API 版本（暂用模拟数据）
    // TODO: 接入微信支付 V3 SDK
    return {
      prepayId: `mock_${Date.now()}`,
      appId: this.appId,
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: Math.random().toString(36).substring(2, 15),
      package: `prepay_id=mock_${Date.now()}`,
      signType: 'RSA',
      paySign: 'mock_sign',
    };
  }

  /** 微信退款能力是否已配置（商户 APIv3 密钥 + 证书私钥 + 证书序列号） */
  isRefundConfigured(): boolean {
    return !!(this.mchId && this.privateKey && this.serialNo && this.apiV3Key);
  }

  /**
   * 申请微信退款（V3 退款接口 /v3/refund/domestic/refunds）
   * 未配置退款能力时降级为模拟成功（与 createUnifiedOrder 的 mock 风格一致），
   * 商户真实配好 WECHAT_API_V3_KEY / WECHAT_PRIVATE_KEY / WECHAT_MCH_SERIAL_NO 后自动切换真实调用。
   */
  async refundOrder(params: {
    outTradeNo: string;
    transaction_id?: string;
    totalFee: number;   // 单位：分
    refundFee: number;  // 单位：分
    reason?: string;
  }): Promise<{ refundId: string; status: string }> {
    // W-03: 退款未配置时 fail-closed，生产环境直接报错
    if (!this.isRefundConfigured()) {
      if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MOCK_PAY !== 'true') {
        throw new BadRequestException('退款通道未配置（需配置 WECHAT_API_V3_KEY / WECHAT_PRIVATE_KEY / WECHAT_MCH_SERIAL_NO）');
      }
      console.warn('[WechatService] 微信退款未配置，使用模拟退款结果（开发环境）');
      return { refundId: `mock_refund_${Date.now()}`, status: 'SUCCESS' };
    }

    const url = 'https://api.mch.weixin.qq.com/v3/refund/domestic/refunds';
    const urlPath = '/v3/refund/domestic/refunds';
    const bodyObj: any = {
      out_trade_no: params.outTradeNo,
      amount: {
        refund: params.refundFee,
        total: params.totalFee,
        currency: 'CNY',
      },
      reason: params.reason || '客户申请退款',
    };
    if (params.transaction_id) bodyObj.transaction_id = params.transaction_id;

    const body = JSON.stringify(bodyObj);
    const authorization = this.buildRefundAuthorization('POST', urlPath, body);

    try {
      const response = await axios.post(url, body, {
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'rongcheng-admin/1.0',
        },
      });
      const data = response.data;
      // 真实环境：data.resource.ciphertext 需用 apiV3Key 做 AES-256-GCM 解密得到 refund_status。
      // 此处以返回含 out_refund_no 视为受理成功。
      return { refundId: data.out_refund_no || data.refund_id || '', status: 'SUCCESS' };
    } catch (err: any) {
      const resp = err?.response?.data;
      console.error('[WechatService] 微信退款调用失败:', resp || err.message);
      throw new BadRequestException(`微信退款失败: ${resp?.message || err.message}`);
    }
  }

  /** 构造微信支付 V3 请求签名头（RSA-SHA256） */
  private buildRefundAuthorization(method: string, urlPath: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signature = crypto.createSign('RSA-SHA256').update(message).sign(this.privateKey, 'base64');
    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.serialNo}"`;
  }

  /**
   * 微信支付回调通知处理
   */
  /** 微信支付是否已正确配置（商户号 + API 密钥 + AppId） */
  isPayConfigured(): boolean {
    return !!(this.mchId && this.mchKey && this.appId);
  }

  /**
   * 微信支付回调通知处理
   * ⚠️ 生产必做（TODO）：微信支付 V3 回调需完成：
   *   1. 用平台证书公钥验 Wechatpay-Signature（对 timestamp+nonce+body 做 SHA256-RSA 验签）
   *   2. 用 APIv3 密钥（WECHAT_API_V3_KEY）对 resource.ciphertext 做 AES-256-GCM 解密得到明文
   *   3. 校验 out_trade_no / transaction_id / trade_state === 'SUCCESS'
   * 以下为兼容开发环境的简化解析（未验签），接入真实商户后务必补全验签，
   * 否则存在伪造回调风险。
   */
  async handlePayNotify(notifyData: any, headers?: any): Promise<{ order_no: string; transaction_id: string } | null> {
    // V3 格式：{ resource: { ciphertext, ... } }
    if (notifyData?.resource?.ciphertext) {
      if (!this.isPayConfigured()) {
        return null;
      }
      // TODO(生产): 用 WECHAT_API_V3_KEY 解密 resource.ciphertext 并校验签名，例如：
      // const plain = this._decryptResource(notifyData.resource);
      // if (plain.trade_state !== 'SUCCESS') return null;
      // return { order_no: plain.out_trade_no, transaction_id: plain.transaction_id };
      return null;
    }

    // V3 生产模式：SHA256-RSA 签名验签 + AES-256-GCM 解密 + trade_state 校验
    if (notifyData?.resource?.ciphertext && this.isPayConfigured()) {
      const resource = notifyData.resource;
      // Step 1：显式签名校验（Wechatpay-Signature = SHA256-RSA(platformCert, timestamp+nonce+body)）
      if (headers) {
        const signature = headers['wechatpay-signature'] || headers['Wechatpay-Signature'];
        const timestamp = headers['wechatpay-timestamp'] || headers['Wechatpay-Timestamp'];
        const nonce = headers['wechatpay-nonce'] || headers['Wechatpay-Nonce'];
        if (signature && timestamp && nonce) {
          const message = timestamp + nonce + JSON.stringify(notifyData);
          const verified = crypto.createVerify('RSA-SHA256')
            .update(message)
            .verify(this.certificate, signature, 'base64');
          if (!verified) {
            console.error('[WechatService] V3 支付回调签名验签失败，疑似伪造');
            return null;
          }
        }
      }
      // Step 2：AES-256-GCM 解密 ciphertext
      const plain = this._decryptResource(resource);
      if (!plain) return null;
      // Step 3：校验交易状态
      if (plain.trade_state !== 'SUCCESS') {
        console.warn('[WechatService] 支付回调 trade_state 非 SUCCESS:', plain.trade_state);
        return null;
      }
      return { order_no: plain.out_trade_no, transaction_id: plain.transaction_id };
    }

    // V2 兼容：有 mchKey 时做摘要校验防伪造
    if (this.mchKey) {
      const { out_trade_no, transaction_id, sign } = notifyData || {};
      if (!out_trade_no) return null;
      // 构造待签名字符串（微信支付 V2 签名规则：按 key 字典序排列 value）
      const keys = ['out_trade_no', 'result_code', 'trade_state', 'transaction_id', 'time_end'].filter(k => notifyData[k]);
      keys.sort();
      const str = keys.map(k => k + '=' + notifyData[k]).join('&') + '&key=' + this.mchKey;
      const expected = crypto.createHash('md5').update(str).digest('hex').toUpperCase();
      if (sign && sign.toUpperCase() !== expected) {
        console.error('[WechatService] V2 支付回调签名校验失败，疑似伪造');
        return null;
      }
      return { order_no: out_trade_no, transaction_id: transaction_id || '' };
    }

    // 未配置任何密钥：开发模式直接信任（仅用于本地调试）
    const { out_trade_no, transaction_id } = notifyData || {};
    if (!out_trade_no) return null;
    return { order_no: out_trade_no, transaction_id: transaction_id || '' };
  }

  /**
   * 处理微信退款结果回调（POST /wechat/refund-notify）
   *
   * 微信 V3 退款回调格式：
   * {
   *   ciphertext: "...",   // AES-256-GCM 加密的退款通知正文
   *   nonce: "...",         // 加密使用的随机串
   *   associated_data: "refund"  // 绑定的数据标识，固定 "refund"
   * }
   *
   * 解密后明文字段示例：
   * {
   *   out_trade_no: "RCBKxxx",       // 原订单号
   *   out_refund_no: "REFUNDxxx",    // 退款单号
   *   refund_id: "xxx",               // 微信退款单号
   *   refund_status: "SUCCESS",       // SUCCESS | FAIL
   *   total: 100,                    // 订单总金额（分）
   *   refund: 100,                   // 退款金额（分）
   *   refund_recv_accout: "..."      // 退款入账账户
   * }
   *
   * 生产环境：必须用 apiV3Key 对 ciphertext 做 AES-256-GCM 解密后验签。
   * 当前实现：开发环境跳过解密，直接从 plaintext 字段读取（方便测试）。
   */
  async handleRefundNotify(notifyData: any): Promise<{ refundId: string; status: string; order_id?: string } | null> {
    try {
      let refundStatus: string;
      let outTradeNo: string;
      let outRefundNo: string;
      let refundId = '';
      let refundFee = 0;

      // W-02: 仅接受 resource.ciphertext 路径（V3 格式），删除 plaintext 明文注入和 V2 兜底
      if (!notifyData?.resource?.ciphertext) {
        console.warn('[WechatService] 退款回调仅接受 V3 ciphertext 格式，拒绝明文/旧版格式');
        return null;
      }
      if (!this.isRefundConfigured()) {
        console.error('[WechatService] 退款未配置，拒绝处理回调');
        return null;
      }
      const decrypted = this._decryptRefundResource(notifyData.resource);
      if (!decrypted) return null;
      refundStatus = decrypted.refund_status;
      outTradeNo = decrypted.out_trade_no;
      outRefundNo = decrypted.out_refund_no || '';
      refundId = decrypted.refund_id || '';
      refundFee = Number(decrypted.refund || 0);

      if (!outTradeNo) return null;


      // 退款状态 SUCCESS → 置订单为已退款（9）+ 写入退款流水
      if (refundStatus === 'SUCCESS') {
        const order = await this.prisma.seal_orders.findFirst({ where: { order_no: outTradeNo } });
        if (order && order.status === 8) {
          await this.prisma.seal_orders.update({
            where: { id: order.id },
            data: {
              status: 9,
              status_text: '已退款',
              remark: (() => {
                try {
                  const r = JSON.parse(order.remark || '{}');
                  r.refund = { ...r.refund, refundStatus: 'SUCCESS', confirmedAt: new Date().toISOString(), refundFee };
                  return JSON.stringify(r);
                } catch {
                  return JSON.stringify({ refund: { refundStatus: 'SUCCESS', confirmedAt: new Date().toISOString(), refundFee } });
                }
              })(),
            },
          });
          // 退款成功后自动写入退款流水
          const existRefundFlow = await this.prisma.transaction_flows.findFirst({
            where: { order_id: order.id, trade_type: 'refund' },
          });
          if (!existRefundFlow && refundFee > 0) {
            const dt = new Date();
            const ts = String(dt.getTime()).slice(-6);
            const ymd = dt.toISOString().slice(0, 10).replace(/-/g, '');
            const amt = refundFee / 100;
            let businessType = '退款';
            if (order.module === 'seal') businessType = '刻章';
            else if (order.module === 'newspaper') businessType = '登报';
            else if (order.module === 'bookkeeping') businessType = '代理记账';
            const assign = await this.prisma.order_assignments.findFirst({
              where: { order_id: order.id },
              include: { outlet: { select: { id: true, name: true } } },
            });
            await this.prisma.transaction_flows.create({
              data: {
                transaction_no: 'TF' + ymd + ts,
                order_id: order.id,
                order_no: order.order_no,
                module: order.module,
                business_type: businessType,
                trade_type: 'refund',
                user_id: order.user_id,
                user_name: null,
                user_phone: null,
                amount: amt,
                fee: 0,
                net_amount: amt,
                pay_method: order.pay_method || 'wechat',
                status: 'success',
                status_text: '退款成功',
                transaction_id: refundId,
                outlet_id: assign?.outlet_id || null,
                outlet_name: assign?.outlet?.name || null,
                remark: '微信退款回调',
                created_at: dt,
                updated_at: dt,
              },
            });
          }
        }
        return { refundId, status: 'SUCCESS', order_id: order?.id };
      }

      // 退款失败：记录日志，保留 status=8 供管理员人工处理
      if (refundStatus === 'FAIL') {
        console.error(`[WechatService] 退款失败 outTradeNo=${outTradeNo} outRefundNo=${outRefundNo} reason=${notifyData?.refund_desc || '未知'}`);
        const order = await this.prisma.seal_orders.findFirst({ where: { order_no: outTradeNo } });
        if (order) {
          const existingRemark = (() => { try { return JSON.parse(order.remark || '{}'); } catch { return {}; } })();
          existingRemark.refundFailed = {
            outRefundNo,
            reason: notifyData?.refund_desc,
            failedAt: new Date().toISOString(),
          };
          await this.prisma.seal_orders.update({
            where: { id: order.id },
            data: { remark: JSON.stringify(existingRemark) },
          });
        }
        return { refundId: outRefundNo, status: 'FAIL', order_id: order?.id };
      }

      return { refundId, status: refundStatus };
    } catch (err) {
      console.error('[WechatService] 处理退款回调异常:', err);
      return null;
    }
  }

  /** AES-256-GCM 解密微信 V3 退款通知密文 */
  /**
   * 解密微信支付 V3 回调通知（支付通知用 associated_data='transaction'）
   */
  private _decryptResource(resource: { ciphertext: string; nonce: string; associated_data?: string }): any | null {
    try {
      const key = Buffer.from(this.apiV3Key, 'utf8');
      const nonce = Buffer.from(resource.nonce, 'utf8');
      const ciphertext = Buffer.from(resource.ciphertext, 'base64');
      const associatedData = resource.associated_data || 'transaction';
      const authTag = ciphertext.slice(-16);
      const encrypted = ciphertext.slice(0, -16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8'));
    } catch (err) {
      console.error('[WechatService] AES-256-GCM 解密支付通知失败:', err);
      return null;
    }
  }

  /**
   * 解密微信支付 V3 退款回调（退款通知用 associated_data='refund'）
   */
  private _decryptRefundResource(resource: { ciphertext: string; nonce: string; associated_data?: string }): any | null {
    try {
      const key = Buffer.from(this.apiV3Key, 'utf8');
      const nonce = Buffer.from(resource.nonce, 'utf8');
      const ciphertext = Buffer.from(resource.ciphertext, 'base64');
      const associatedData = resource.associated_data || 'refund';
      const authTag = ciphertext.slice(-16);
      const encrypted = ciphertext.slice(0, -16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8'));
    } catch (err) {
      console.error('[WechatService] AES-256-GCM 解密退款通知失败:', err);
      return null;
    }
  }
}
