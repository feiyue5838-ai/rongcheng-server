"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
var common_1 = require("@nestjs/common");
var OrderService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var OrderService = _classThis = /** @class */ (function () {
        function OrderService_1(prisma, wechatService) {
            this.prisma = prisma;
            this.wechatService = wechatService;
        }
        // ==================== 创建刻章订单 ====================
        OrderService_1.prototype.createSealOrder = function (userId, dto) {
            return __awaiter(this, void 0, void 0, function () {
                var type, companyName, sealReason, contactPhone, legalPhone, licenseRegion, addressId, remark, sealIds, packageId, items, addressData, totalPrice, orderItems, _i, items_1, item, orderNo, order;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            type = dto.type, companyName = dto.companyName, sealReason = dto.sealReason, contactPhone = dto.contactPhone, legalPhone = dto.legalPhone, licenseRegion = dto.licenseRegion, addressId = dto.addressId, remark = dto.remark, sealIds = dto.sealIds, packageId = dto.packageId, items = dto.items;
                            addressData = null;
                            if (!addressId) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.address.findUnique({ where: { id: addressId } })];
                        case 1:
                            addressData = _a.sent();
                            if (!addressData)
                                throw new common_1.NotFoundException('收货地址不存在');
                            _a.label = 2;
                        case 2:
                            totalPrice = 0;
                            orderItems = [];
                            // 从 items（小程序端传入的订单明细）计算总价
                            if (items && items.length > 0) {
                                for (_i = 0, items_1 = items; _i < items_1.length; _i++) {
                                    item = items_1[_i];
                                    totalPrice += Number(item.price) * (item.quantity || 1);
                                    orderItems.push({
                                        itemType: item.itemType,
                                        sealId: item.sealId || null,
                                        packageId: item.packageId || null,
                                        name: item.name,
                                        price: item.price,
                                        quantity: item.quantity || 1,
                                        image: item.image || null,
                                    });
                                }
                            }
                            orderNo = this.generateOrderNo('RC');
                            return [4 /*yield*/, this.prisma.sealOrder.create({
                                    data: {
                                        orderNo: orderNo,
                                        userId: userId,
                                        module: 'seal',
                                        type: type === 'company' ? '企业刻章' : type === 'personal' ? '个人印章' : type === 'electronic' ? '电子印章' : '刻章备案',
                                        companyName: companyName || null,
                                        licenseRegion: licenseRegion || null,
                                        sealReason: sealReason || null,
                                        contactPhone: contactPhone || null,
                                        legalPhone: legalPhone || null,
                                        totalPrice: totalPrice,
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
                                })];
                        case 3:
                            order = _a.sent();
                            return [2 /*return*/, order];
                    }
                });
            });
        };
        // ==================== 创建登报订单 ====================
        OrderService_1.prototype.createNewspaperOrder = function (userId, dto) {
            return __awaiter(this, void 0, void 0, function () {
                var type, content, newspaperId, templateId, addressId, remark, price, orderNo, order;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            type = dto.type, content = dto.content, newspaperId = dto.newspaperId, templateId = dto.templateId, addressId = dto.addressId, remark = dto.remark, price = dto.price;
                            orderNo = this.generateOrderNo('RB');
                            return [4 /*yield*/, this.prisma.sealOrder.create({
                                    data: {
                                        orderNo: orderNo,
                                        userId: userId,
                                        module: 'newspaper',
                                        type: type || '登报声明',
                                        totalPrice: price || 0,
                                        contactPhone: null,
                                        addressId: addressId || null,
                                        remark: remark || null,
                                        status: 1,
                                        statusText: '待支付',
                                        orderItems: {
                                            create: [{
                                                    itemType: 'newspaper',
                                                    name: dto.newspaperName || '报纸登报',
                                                    price: price || 0,
                                                    quantity: 1,
                                                }],
                                        },
                                    },
                                    include: { orderItems: true },
                                })];
                        case 1:
                            order = _a.sent();
                            return [2 /*return*/, order];
                    }
                });
            });
        };
        // ==================== 订单列表（用户端） ====================
        OrderService_1.prototype.getMyOrders = function (userId, query) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, pageSize, module, status, where, _c, orders, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.pageSize, pageSize = _b === void 0 ? 10 : _b, module = query.module, status = query.status;
                            where = { userId: userId };
                            if (module)
                                where.module = module;
                            if (status)
                                where.status = Number(status);
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.sealOrder.findMany({
                                        where: where,
                                        include: {
                                            orderItems: { include: { seal: true } },
                                            reviews: true,
                                        },
                                        orderBy: { createdAt: 'desc' },
                                        skip: (page - 1) * pageSize,
                                        take: Number(pageSize),
                                    }),
                                    this.prisma.sealOrder.count({ where: where }),
                                ])];
                        case 1:
                            _c = _d.sent(), orders = _c[0], total = _c[1];
                            return [2 /*return*/, {
                                    list: orders,
                                    pagination: {
                                        page: Number(page),
                                        pageSize: Number(pageSize),
                                        total: total,
                                        totalPages: Math.ceil(total / Number(pageSize)),
                                    },
                                }];
                    }
                });
            });
        };
        // ==================== 订单详情 ====================
        OrderService_1.prototype.getOrderDetail = function (orderId, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var where, order;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = { id: orderId };
                            if (userId)
                                where.userId = userId;
                            return [4 /*yield*/, this.prisma.sealOrder.findFirst({
                                    where: where,
                                    include: {
                                        user: { select: { id: true, nickname: true, phone: true } },
                                        orderItems: { include: { seal: true, package: true } },
                                        materials: true,
                                        reviews: { include: { user: { select: { nickname: true, avatar: true } } } },
                                        assignment: { include: { store: { select: { id: true, name: true, phone: true } } } },
                                        receipts: true,
                                    },
                                })];
                        case 1:
                            order = _a.sent();
                            if (!order)
                                throw new common_1.NotFoundException('订单不存在');
                            return [2 /*return*/, order];
                    }
                });
            });
        };
        // ==================== 微信支付 ====================
        OrderService_1.prototype.createPayOrder = function (orderId, userId, openid) {
            return __awaiter(this, void 0, void 0, function () {
                var order, payResult;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.sealOrder.findFirst({
                                where: { id: orderId, userId: userId },
                            })];
                        case 1:
                            order = _a.sent();
                            if (!order)
                                throw new common_1.NotFoundException('订单不存在');
                            if (order.status !== 1)
                                throw new common_1.BadRequestException('订单状态不允许支付');
                            if (!(Number(order.totalPrice) === 0)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.sealOrder.update({
                                    where: { id: orderId },
                                    data: { status: 2, statusText: '已支付', payTime: new Date(), payMethod: 'free' },
                                })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, { type: 'free', orderId: orderId }];
                        case 3: return [4 /*yield*/, this.wechatService.createUnifiedOrder({
                                outTradeNo: order.orderNo,
                                totalFee: Math.round(Number(order.totalPrice) * 100), // 转为分
                                body: "\u84C9\u57CE\u4F01\u670D-".concat(order.type),
                                openid: openid,
                                notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || 'https://your-domain.com/api/wechat/pay-notify',
                            })];
                        case 4:
                            payResult = _a.sent();
                            return [2 /*return*/, {
                                    type: 'wechat',
                                    payment: payResult,
                                }];
                    }
                });
            });
        };
        // ==================== 管理端：订单列表 ====================
        OrderService_1.prototype.adminGetOrders = function (query) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, pageSize, module, status, keyword, startDate, endDate, where, _c, orders, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.pageSize, pageSize = _b === void 0 ? 20 : _b, module = query.module, status = query.status, keyword = query.keyword, startDate = query.startDate, endDate = query.endDate;
                            where = {};
                            if (module)
                                where.module = module;
                            if (status)
                                where.status = Number(status);
                            if (keyword) {
                                where.OR = [
                                    { orderNo: { contains: keyword } },
                                    { companyName: { contains: keyword } },
                                    { contactPhone: { contains: keyword } },
                                ];
                            }
                            if (startDate || endDate) {
                                where.createdAt = {};
                                if (startDate)
                                    where.createdAt.gte = new Date(startDate);
                                if (endDate)
                                    where.createdAt.lte = new Date(endDate);
                            }
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.sealOrder.findMany({
                                        where: where,
                                        include: {
                                            user: { select: { id: true, nickname: true, phone: true } },
                                            orderItems: { include: { seal: true } },
                                            assignment: { include: { store: { select: { id: true, name: true } } } },
                                            receipts: true,
                                        },
                                        orderBy: { createdAt: 'desc' },
                                        skip: (page - 1) * pageSize,
                                        take: Number(pageSize),
                                    }),
                                    this.prisma.sealOrder.count({ where: where }),
                                ])];
                        case 1:
                            _c = _d.sent(), orders = _c[0], total = _c[1];
                            return [2 /*return*/, {
                                    list: orders.map(function (o) { return ({
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
                                        assignment: o.assignment ? (function () {
                                            var _a;
                                            var map = { 0: '待接单', 1: '已接单', 2: '制作中', 3: '已发货', 4: '已完成', 5: '已拒绝' };
                                            return __assign(__assign({}, o.assignment), { statusText: (_a = map[o.assignment.status]) !== null && _a !== void 0 ? _a : o.assignment.statusText });
                                        })() : null,
                                        receipts: o.receipts,
                                    }); }),
                                    pagination: {
                                        page: Number(page),
                                        pageSize: Number(pageSize),
                                        total: total,
                                        totalPages: Math.ceil(total / Number(pageSize)),
                                    },
                                }];
                    }
                });
            });
        };
        // ==================== 管理端：更新订单状态 ====================
        OrderService_1.prototype.adminUpdateOrder = function (orderId, dto, adminId) {
            return __awaiter(this, void 0, void 0, function () {
                var order, statusMap, updateData;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.sealOrder.findUnique({ where: { id: orderId } })];
                        case 1:
                            order = _a.sent();
                            if (!order)
                                throw new common_1.NotFoundException('订单不存在');
                            statusMap = {
                                1: '待支付', 2: '已支付', 3: '制作中', 4: '已发货',
                                5: '已完成', 6: '已取消', 7: '退款中', 8: '已退款',
                            };
                            updateData = __assign({}, dto);
                            if (dto.status !== undefined) {
                                updateData.statusText = statusMap[dto.status] || '未知状态';
                            }
                            updateData.processedBy = adminId;
                            updateData.processedAt = new Date();
                            return [2 /*return*/, this.prisma.sealOrder.update({
                                    where: { id: orderId },
                                    data: updateData,
                                })];
                    }
                });
            });
        };
        // ==================== 统计 ====================
        OrderService_1.prototype.getStatistics = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, totalOrders, todayOrders, pendingOrders, totalRevenue;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, Promise.all([
                                this.prisma.sealOrder.count(),
                                this.prisma.sealOrder.count({
                                    where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
                                }),
                                this.prisma.sealOrder.count({ where: { status: 1 } }),
                                this.prisma.sealOrder.aggregate({
                                    _sum: { payPrice: true },
                                    where: { status: { in: [2, 3, 4, 5] } },
                                }),
                            ])];
                        case 1:
                            _a = _b.sent(), totalOrders = _a[0], todayOrders = _a[1], pendingOrders = _a[2], totalRevenue = _a[3];
                            return [2 /*return*/, {
                                    totalOrders: totalOrders,
                                    todayOrders: todayOrders,
                                    pendingOrders: pendingOrders,
                                    totalRevenue: totalRevenue._sum.payPrice || 0,
                                }];
                    }
                });
            });
        };
        // ==================== 订单分配与交付 ====================
        /** 待分配订单列表 */
        OrderService_1.prototype.getUnassignedOrders = function (params) {
            return __awaiter(this, void 0, void 0, function () {
                var page, pageSize, module, keyword, where, _a, list, total;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            page = params.page, pageSize = params.pageSize, module = params.module, keyword = params.keyword;
                            where = { assignmentStatus: 0, status: { in: [2, 3] } };
                            if (module)
                                where.module = module;
                            if (keyword) {
                                where.OR = [
                                    { orderNo: { contains: keyword } },
                                    { companyName: { contains: keyword } },
                                    { contactPhone: { contains: keyword } },
                                ];
                            }
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.sealOrder.findMany({
                                        where: where,
                                        skip: (page - 1) * pageSize,
                                        take: pageSize,
                                        orderBy: { createdAt: 'desc' },
                                        include: {
                                            user: { select: { id: true, nickname: true, phone: true } },
                                            orderItems: true,
                                            assignment: {
                                                include: { store: { select: { id: true, name: true, phone: true } } },
                                            },
                                            receipts: true,
                                        },
                                    }),
                                    this.prisma.sealOrder.count({ where: where }),
                                ])];
                        case 1:
                            _a = _b.sent(), list = _a[0], total = _a[1];
                            return [2 /*return*/, {
                                    list: list.map(function (o) { return ({
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
                                    }); }),
                                    pagination: { page: page, pageSize: pageSize, total: total, totalPages: Math.ceil(total / pageSize) },
                                }];
                    }
                });
            });
        };
        /** 分配订单给门店 */
        OrderService_1.prototype.assignOrder = function (orderId, storeId, remark, adminId) {
            return __awaiter(this, void 0, void 0, function () {
                var order, store;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.sealOrder.findUnique({ where: { id: orderId } })];
                        case 1:
                            order = _a.sent();
                            if (!order)
                                throw new common_1.NotFoundException('订单不存在');
                            if (order.status < 2)
                                throw new common_1.BadRequestException('订单未支付，无法分配');
                            if (order.assignmentStatus > 0)
                                throw new common_1.BadRequestException('订单已分配，请勿重复分配');
                            return [4 /*yield*/, this.prisma.store.findUnique({ where: { id: storeId } })];
                        case 2:
                            store = _a.sent();
                            if (!store)
                                throw new common_1.NotFoundException('门店不存在');
                            if (store.status === 0)
                                throw new common_1.BadRequestException('门店已被禁用');
                            return [4 /*yield*/, this.prisma.$transaction([
                                    this.prisma.orderAssignment.create({
                                        data: {
                                            orderId: orderId,
                                            storeId: storeId,
                                            status: 1,
                                            statusText: '待接单',
                                            assignedBy: adminId,
                                            remark: remark,
                                        },
                                    }),
                                    this.prisma.sealOrder.update({
                                        where: { id: orderId },
                                        data: { assignmentStatus: 1 },
                                    }),
                                ])];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, { message: '分配成功' }];
                    }
                });
            });
        };
        /** 门店接单 */
        OrderService_1.prototype.acceptOrder = function (orderId, storeId) {
            return __awaiter(this, void 0, void 0, function () {
                var assignment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.orderAssignment.findUnique({
                                where: { orderId: orderId },
                            })];
                        case 1:
                            assignment = _a.sent();
                            if (!assignment)
                                throw new common_1.NotFoundException('订单分配记录不存在');
                            if (assignment.storeId !== storeId)
                                throw new common_1.BadRequestException('无权操作此订单');
                            if (assignment.status === 2)
                                throw new common_1.BadRequestException('该订单已接单');
                            if (assignment.status === 3)
                                throw new common_1.BadRequestException('该订单已交付');
                            return [4 /*yield*/, this.prisma.$transaction([
                                    this.prisma.orderAssignment.update({
                                        where: { id: assignment.id },
                                        data: { status: 2, statusText: '制作中', acceptedAt: new Date() },
                                    }),
                                    this.prisma.sealOrder.update({
                                        where: { id: orderId },
                                        data: { assignmentStatus: 2, statusText: '制作中' },
                                    }),
                                ])];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, { message: '接单成功' }];
                    }
                });
            });
        };
        /** 门店提交交付（自动生效） */
        OrderService_1.prototype.deliverOrder = function (orderId, dto, storeId) {
            return __awaiter(this, void 0, void 0, function () {
                var assignment;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.orderAssignment.findUnique({
                                where: { orderId: orderId },
                                include: { order: true },
                            })];
                        case 1:
                            assignment = _a.sent();
                            if (!assignment)
                                throw new common_1.NotFoundException('订单分配记录不存在');
                            if (assignment.storeId !== storeId)
                                throw new common_1.BadRequestException('无权操作此订单');
                            if (assignment.status === 1)
                                throw new common_1.BadRequestException('请先接单再交付');
                            if (assignment.status === 3)
                                throw new common_1.BadRequestException('该订单已交付');
                            return [4 /*yield*/, this.prisma.$transaction(__spreadArray(__spreadArray([], dto.receipts.map(function (r) {
                                    return _this.prisma.deliveryReceipt.create({
                                        data: { orderId: orderId, storeId: storeId, type: r.type, url: r.url, remark: r.remark },
                                    });
                                }), true), [
                                    this.prisma.orderAssignment.update({
                                        where: { id: assignment.id },
                                        data: { status: 3, statusText: '已完成' },
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
                                    this.prisma.store.update({
                                        where: { id: storeId },
                                        data: { totalOrders: { increment: 1 } },
                                    }),
                                ], false))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, { message: '交付成功，回执已自动展示给客户' }];
                    }
                });
            });
        };
        /** 客户确认签收 */
        OrderService_1.prototype.signOrder = function (orderId) {
            return __awaiter(this, void 0, void 0, function () {
                var order;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.sealOrder.findUnique({ where: { id: orderId } })];
                        case 1:
                            order = _a.sent();
                            if (!order)
                                throw new common_1.NotFoundException('订单不存在');
                            if (order.deliveryStatus !== 1)
                                throw new common_1.BadRequestException('订单未交付，无法签收');
                            return [4 /*yield*/, this.prisma.sealOrder.update({
                                    where: { id: orderId },
                                    data: { deliveryStatus: 2, signedAt: new Date() },
                                })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, { message: '签收成功' }];
                    }
                });
            });
        };
        /** 订单交付信息 */
        OrderService_1.prototype.getDeliveryInfo = function (orderId) {
            return __awaiter(this, void 0, void 0, function () {
                var order;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.sealOrder.findUnique({
                                where: { id: orderId },
                                include: {
                                    assignment: {
                                        include: { store: { select: { id: true, name: true, contact: true, phone: true } } },
                                    },
                                    receipts: { select: { id: true, type: true, url: true, remark: true, createdAt: true } },
                                },
                            })];
                        case 1:
                            order = _a.sent();
                            if (!order)
                                throw new common_1.NotFoundException('订单不存在');
                            return [2 /*return*/, {
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
                                        store: order.assignment.store,
                                    } : null,
                                    receipts: order.receipts,
                                }];
                    }
                });
            });
        };
        // ==================== 工具方法 ====================
        OrderService_1.prototype.generateOrderNo = function (prefix) {
            var date = new Date();
            var dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
            var random = Math.random().toString(36).substring(2, 8).toUpperCase();
            return "".concat(prefix).concat(dateStr).concat(random);
        };
        return OrderService_1;
    }());
    __setFunctionName(_classThis, "OrderService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        OrderService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return OrderService = _classThis;
}();
exports.OrderService = OrderService;
