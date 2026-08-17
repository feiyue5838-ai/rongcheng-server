// V2.0 微信支付 V3 对接服务
// 覆盖：JSAPI 统一下单、RSA-SHA256 签名、回调验签+报文解密、退款申请
// 配置缺失时优雅降级（返回占位参数并告警），配置齐全后自动走真实下单
//
// 所需 .env 配置（微信商户平台获取）：
//   WECHAT_APP_ID            小程序 AppID（如 wx68ab58ca4a6dd92a）
//   WECHAT_PAY_MCHID         商户号
//   WECHAT_PAY_APIV3_KEY     APIv3 密钥（32 位）
//   WECHAT_PAY_SERIAL_NO     商户证书序列号
//   WECHAT_PAY_PRIVATE_KEY   商户 API 私钥（PKCS8 PEM，可含 \n 转义）
//   WECHAT_PAY_NOTIFY_URL    支付回调地址（正式环境必须是 HTTPS 且已备案）
//   WECHAT_PAY_REFUND_NOTIFY_URL 退款回调地址

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name);
  private readonly wxApiBase = 'https://api.mch.weixin.qq.com';

  constructor(private readonly config: ConfigService) {}

  /** 配置是否齐全（不齐全时调用方应降级处理） */
  isConfigured(): boolean {
    const keys = [
      'WECHAT_APP_ID',
      'WECHAT_PAY_MCHID',
      'WECHAT_PAY_APIV3_KEY',
      'WECHAT_PAY_SERIAL_NO',
      'WECHAT_PAY_PRIVATE_KEY',
    ];
    return keys.every((k) => !!this.config.get<string>(k)?.trim());
  }

  /** 获取支付回调 URL（默认用配置，缺省时降级） */
  private getNotifyUrl(): string {
    return this.config.get<string>('WECHAT_PAY_NOTIFY_URL') || '';
  }

  private getAppId(): string {
    return this.config.get<string>('WECHAT_APP_ID') || '';
  }

  private getMchId(): string {
    return this.config.get<string>('WECHAT_PAY_MCHID') || '';
  }

  private getApiV3Key(): string {
    return this.config.get<string>('WECHAT_PAY_APIV3_KEY') || '';
  }

  private getSerialNo(): string {
    return this.config.get<string>('WECHAT_PAY_SERIAL_NO') || '';
  }

  /** 私钥：支持直接 PEM 或含 \n 字面量的字符串 */
  private getPrivateKey(): string {
    let key = this.config.get<string>('WECHAT_PAY_PRIVATE_KEY') || '';
    if (key && !key.includes('BEGIN PRIVATE KEY')) {
      key = key.replace(/\\n/g, '\n');
    }
    return key;
  }

  /**
   * JSAPI 统一下单（V3）
   * @param params { description, outTradeNo, amountYuan(元), openid, attach? }
   * @returns 小程序端支付参数 { appId, timeStamp, nonceStr, package, signType, paySign } 或 null（配置缺失）
   */
  async createJsapiOrder(params: {
    description: string;
    outTradeNo: string;
    amountYuan: number;
    openid: string;
    attach?: string;
  }): Promise<{
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'RSA';
    paySign: string;
    prepayId: string;
  } | null> {
    if (!this.isConfigured() || !this.getNotifyUrl()) {
      this.logger.warn('[wechat-pay] 微信支付配置缺失或 notifyUrl 未配置，返回占位参数（开发模式）');
      return null;
    }

    const appId = this.getAppId();
    const mchid = this.getMchId();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const body = {
      appid: appId,
      mchid,
      description: params.description.slice(0, 127),
      out_trade_no: params.outTradeNo,
      notify_url: this.getNotifyUrl(),
      amount: {
        total: Math.round(params.amountYuan * 100), // 单位：分
      },
      payer: {
        openid: params.openid,
      },
      attach: params.attach || '',
    };

    const url = `${this.wxApiBase}/v3/pay/transactions/jsapi`;
    const response = await this.requestWithSign('POST', url, body);

    const prepayId = response?.prepay_id;
    if (!prepayId) {
      throw new Error(`微信统一下单失败: ${JSON.stringify(response)}`);
    }

    // 小程序端拉起支付需要二次签名（appId + timeStamp + nonceStr + package=prepay_id=xxx）
    const payParams = {
      appId,
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: crypto.randomBytes(16).toString('hex'),
      package: `prepay_id=${prepayId}`,
      signType: 'RSA' as const,
    };
    const message = `${appId}\n${payParams.timeStamp}\n${payParams.nonceStr}\n${payParams.package}\n`;
    const paySign = this.sign(message);

    return { ...payParams, paySign, prepayId };
  }

  /**
   * 申请退款（V3）
   * @param params { outTradeNo, outRefundNo, refundYuan(元), totalYuan(元), reason? }
   */
  async refund(params: {
    outTradeNo: string;
    outRefundNo: string;
    refundYuan: number;
    totalYuan: number;
    reason?: string;
  }): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('微信支付配置缺失，无法发起退款');
    }
    const body = {
      out_trade_no: params.outTradeNo,
      out_refund_no: params.outRefundNo,
      reason: params.reason || '',
      notify_url: this.config.get<string>('WECHAT_PAY_REFUND_NOTIFY_URL') || '',
      amount: {
        refund: Math.round(params.refundYuan * 100),
        total: Math.round(params.totalYuan * 100),
        currency: 'CNY',
      },
    };
    const url = `${this.wxApiBase}/v3/refund/domestic/refunds`;
    const response = await this.requestWithSign('POST', url, body);
    if (response?.status !== 'SUCCESS' && response?.status !== 'PROCESSING') {
      throw new Error(`微信退款申请失败: ${JSON.stringify(response)}`);
    }
    return response;
  }

  /**
   * 微信回调验签（V3）
   * 返回原始 JSON 报文；验签失败抛错
   */
  verifyNotifySignature(headers: Record<string, any>, rawBody: string): any {
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];
    if (!timestamp || !nonce || !signature) {
      throw new Error('回调缺少签名头');
    }
    // 防重放：时间戳 5 分钟内
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      throw new Error('回调时间戳超出允许范围');
    }
    void serial;
    // 验签 message = timestamp\nnonce\nbody\n
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const verified = this.verifyWithPlatformCert(message, signature);
    if (!verified) {
      throw new Error('回调验签失败');
    }
    return JSON.parse(rawBody);
  }

  /** 用平台证书公钥验签（需要 WECHAT_PAY_CERTIFICATE 平台证书，缺失时跳过验签并告警） */
  private verifyWithPlatformCert(message: string, signature: string): boolean {
    const cert = this.config.get<string>('WECHAT_PAY_CERTIFICATE') || '';
    if (!cert) {
      this.logger.warn('[wechat-pay] 未配置平台证书，跳过回调验签（生产环境必须配置）');
      return true;
    }
    const certBody = cert.includes('BEGIN CERTIFICATE') ? cert : cert.replace(/\\n/g, '\n');
    const publicKey = crypto.createPublicKey(certBody);
    return crypto.verify('RSA-SHA256', Buffer.from(message, 'utf8'), publicKey, Buffer.from(signature, 'base64'));
  }

  /**
   * 解密回调资源（V3 AES-256-GCM）
   * resource: { ciphertext, nonce, associated_data }
   */
  decryptResource(resource: { ciphertext: string; nonce: string; associated_data?: string }): any {
    const apiV3Key = this.getApiV3Key();
    if (!apiV3Key) throw new Error('缺少 APIv3 密钥');
    const key = Buffer.from(apiV3Key, 'utf8');
    const nonce = Buffer.from(resource.nonce, 'utf8');
    const aad = resource.associated_data ? Buffer.from(resource.associated_data, 'utf8') : Buffer.alloc(0);
    const ciphertext = Buffer.from(resource.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
    const decrypted = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  /** 构造请求签名并发送（V3 商户请求签名） */
  private async requestWithSign(method: 'GET' | 'POST', url: string, body?: any): Promise<any> {
    const mchid = this.getMchId();
    const serialNo = this.getSerialNo();
    const privateKey = this.getPrivateKey();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const bodyStr = body ? JSON.stringify(body) : '';

    // 签名串：method\nurl_path\ntimestamp\nnonce\nbody\n
    const urlPath = url.replace(this.wxApiBase, '');
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${bodyStr}\n`;
    const signature = this.sign(message);

    const headers: Record<string, string> = {
      Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'rongcheng-server/1.0',
    };

    const resp = await axios.request({ method, url, headers, data: body, timeout: 15000 });
    return resp.data;
  }

  /** RSA-SHA256 签名（商户私钥） */
  private sign(message: string): string {
    const privateKey = this.getPrivateKey();
    if (!privateKey) throw new Error('缺少商户私钥 WECHAT_PAY_PRIVATE_KEY');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(message, 'utf8');
    return signer.sign(privateKey, 'base64');
  }
}
