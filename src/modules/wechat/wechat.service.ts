import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(private config: ConfigService) {
    this.appId = this.config.get<string>('WECHAT_APP_ID') || '';
    this.appSecret = this.config.get<string>('WECHAT_APP_SECRET') || '';
    this.mchId = this.config.get<string>('WECHAT_MCH_ID') || '';
    this.mchKey = this.config.get<string>('WECHAT_MCH_KEY') || '';
    this.privateKey = this.config.get<string>('WECHAT_PRIVATE_KEY') || '';
    this.certificate = this.config.get<string>('WECHAT_CERTIFICATE') || '';
  }

  // ==================== 小程序登录 ====================

  /**
   * 通过 code 获取 openid
   */
  async getOpenidByCode(code: string): Promise<string | null> {
    if (!this.appId || !this.appSecret) {
      console.warn('⚠️ 微信配置未设置，返回模拟 openid（开发环境）');
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
      console.warn('⚠️ 微信配置未设置，返回模拟手机号');
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
      console.warn('⚠️ 微信支付配置未设置，返回模拟支付参数');
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
  async handlePayNotify(notifyData: any, headers?: any): Promise<{ orderNo: string; transactionId: string } | null> {
    // V3 格式：{ resource: { ciphertext, ... } }
    if (notifyData?.resource?.ciphertext) {
      if (!this.isPayConfigured()) {
        console.warn('⚠️ 未配置微信支付商户，开发环境跳过回调验签（上线前需补全 V3 验签+解密）');
        return null;
      }
      // TODO(生产): 用 WECHAT_API_V3_KEY 解密 resource.ciphertext 并校验签名，例如：
      // const plain = this._decryptResource(notifyData.resource);
      // if (plain.trade_state !== 'SUCCESS') return null;
      // return { orderNo: plain.out_trade_no, transactionId: plain.transaction_id };
      return null;
    }

    // 兼容 V2 / 简化字段
    const { out_trade_no, transaction_id } = notifyData || {};
    if (!out_trade_no) return null;
    return { orderNo: out_trade_no, transactionId: transaction_id };
  }
}
