"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatService = void 0;
var common_1 = require("@nestjs/common");
var axios_1 = require("axios");
// import { v2 as wavepay } from 'wechatpay-nodejs-sdk';
var crypto = require("crypto");
var WechatService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var WechatService = _classThis = /** @class */ (function () {
        function WechatService_1(config) {
            this.config = config;
            this.appId = this.config.get('WECHAT_APP_ID') || '';
            this.appSecret = this.config.get('WECHAT_APP_SECRET') || '';
            this.mchId = this.config.get('WECHAT_MCH_ID') || '';
            this.mchKey = this.config.get('WECHAT_MCH_KEY') || '';
            this.privateKey = this.config.get('WECHAT_PRIVATE_KEY') || '';
            this.certificate = this.config.get('WECHAT_CERTIFICATE') || '';
        }
        // ==================== 小程序登录 ====================
        /**
         * 通过 code 获取 openid
         */
        WechatService_1.prototype.getOpenidByCode = function (code) {
            return __awaiter(this, void 0, void 0, function () {
                var url, response, data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.appId || !this.appSecret) {
                                console.warn('⚠️ 微信配置未设置，返回模拟 openid（开发环境）');
                                return [2 /*return*/, "mock_openid_".concat(code)];
                            }
                            url = "https://api.weixin.qq.com/sns/jscode2session?appid=".concat(this.appId, "&secret=").concat(this.appSecret, "&js_code=").concat(code, "&grant_type=authorization_code");
                            return [4 /*yield*/, axios_1.default.get(url)];
                        case 1:
                            response = _a.sent();
                            data = response.data;
                            if (data.errcode) {
                                console.error('微信登录失败:', data);
                                return [2 /*return*/, null];
                            }
                            return [2 /*return*/, data.openid];
                    }
                });
            });
        };
        /**
         * 获取用户手机号
         */
        WechatService_1.prototype.getPhoneNumber = function (code) {
            return __awaiter(this, void 0, void 0, function () {
                var accessToken, url, response, data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.appId || !this.appSecret) {
                                console.warn('⚠️ 微信配置未设置，返回模拟手机号');
                                return [2 /*return*/, '13800138000'];
                            }
                            return [4 /*yield*/, this.getAccessToken()];
                        case 1:
                            accessToken = _a.sent();
                            url = "https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=".concat(accessToken);
                            return [4 /*yield*/, axios_1.default.post(url, { code: code })];
                        case 2:
                            response = _a.sent();
                            data = response.data;
                            if (data.errcode !== 0) {
                                console.error('获取手机号失败:', data);
                                return [2 /*return*/, null];
                            }
                            return [2 /*return*/, data.phone_info.phoneNumber];
                    }
                });
            });
        };
        /**
         * 获取 Access Token（服务端用）
         */
        WechatService_1.prototype.getAccessToken = function () {
            return __awaiter(this, void 0, void 0, function () {
                var cached, url, response, data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.appId || !this.appSecret) {
                                return [2 /*return*/, 'mock_access_token'];
                            }
                            cached = global.__wxAccessToken;
                            if (cached && cached.expiresAt > Date.now()) {
                                return [2 /*return*/, cached.token];
                            }
                            url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=".concat(this.appId, "&secret=").concat(this.appSecret);
                            return [4 /*yield*/, axios_1.default.get(url)];
                        case 1:
                            response = _a.sent();
                            data = response.data;
                            if (data.access_token) {
                                global.__wxAccessToken = {
                                    token: data.access_token,
                                    expiresAt: Date.now() + (data.expires_in - 200) * 1000,
                                };
                                return [2 /*return*/, data.access_token];
                            }
                            throw new common_1.BadRequestException('获取 AccessToken 失败');
                    }
                });
            });
        };
        // ==================== 微信支付 ====================
        /**
         * 创建统一下单
         */
        WechatService_1.prototype.createUnifiedOrder = function (params) {
            return __awaiter(this, void 0, void 0, function () {
                var outTradeNo, totalFee, body, openid, notifyUrl;
                return __generator(this, function (_a) {
                    if (!this.mchId || !this.mchKey) {
                        console.warn('⚠️ 微信支付配置未设置，返回模拟支付参数');
                        return [2 /*return*/, {
                                timeStamp: Math.floor(Date.now() / 1000).toString(),
                                nonceStr: crypto.randomBytes(16).toString('hex'),
                                package: 'prepay_id=mock_prepay_id',
                                signType: 'MD5',
                                paySign: 'mock_pay_sign',
                            }];
                    }
                    outTradeNo = params.outTradeNo, totalFee = params.totalFee, body = params.body, openid = params.openid, notifyUrl = params.notifyUrl;
                    // V3 API 版本（暂用模拟数据）
                    // TODO: 接入微信支付 V3 SDK
                    return [2 /*return*/, {
                            prepayId: "mock_".concat(Date.now()),
                            appId: this.appId,
                            timeStamp: String(Math.floor(Date.now() / 1000)),
                            nonceStr: Math.random().toString(36).substring(2, 15),
                            package: "prepay_id=mock_".concat(Date.now()),
                            signType: 'RSA',
                            paySign: 'mock_sign',
                        }];
                });
            });
        };
        /**
         * 微信支付回调通知处理
         */
        WechatService_1.prototype.handlePayNotify = function (notifyData) {
            return __awaiter(this, void 0, void 0, function () {
                var out_trade_no, transaction_id, trade_state;
                return __generator(this, function (_a) {
                    out_trade_no = notifyData.out_trade_no, transaction_id = notifyData.transaction_id, trade_state = notifyData.trade_state;
                    return [2 /*return*/, { orderNo: out_trade_no, transactionId: transaction_id }];
                });
            });
        };
        return WechatService_1;
    }());
    __setFunctionName(_classThis, "WechatService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        WechatService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return WechatService = _classThis;
}();
exports.WechatService = WechatService;
