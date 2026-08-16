# 《企业服务交易与供应链平台 V2.0》后端 API 接口设计

> 文档版本：V2.0-draft-1
> 编写日期：2026-08-16
> 配套文档：《数据库设计 V2.0》《PRD V2.0 开发计划》
> 适用分支：`feature/ddd-refactor`（V2.0 统一 `orders` 表 + 五维状态模型）

---

## 一、概述

### 1.1 目标
统一三业务线（刻章 / 登报 / 记账）为**单一订单模型**，前端（小程序 / 管理后台 / 供应商端）通过一套 REST API 完成下单、支付、派单、履约、结算、退款全链路闭环。

### 1.2 范围
| 域 | 包含 | 说明 |
|---|---|---|
| 用户端 | 地址、订单 CRUD、下单、支付、确认收货、发票 | 企业客户（微信小程序）|
| 供应商端 | 接单 / 拒单 / 制作 / 备案 / 发货 / 完成、结算查看 | 履约供应商（原「网点」）|
| 管理端 | 审核、派单 / 改派、供应商管理、结算生成/付款、退款审批、审计 | 平台运营 / 财务 |
| 支付域 | 微信支付参数获取、异步回调、退款回调 | 幂等核心 |
| 结算域 | 周期结算单生成、多订单汇总、确认、付款 | 财务执行 |

### 1.3 新旧 API 并行策略
- **V1 现状**：`/api/orders`（旧 seal_orders 体系）、`/api/outlets`（网点）、`/api/transaction`（支付）、`/api/settlement`（结算）、`/api/refund`（退款）。
- **V2.0 新增**：统一前缀 **`/api/v2/`**，基于 `orders` 统一表。
- **过渡**：V2.0 API 与 `/api/orders` 并行运行，前端按模块灰度切换；全部迁移完成后废弃旧 API（保留至少 2 周并行期）。
- **实现路由约定**：
  - 用户端：`/api/v2/user/*`
  - 供应商端：`/api/v2/supplier/*`
  - 管理端：`/api/v2/admin/*`
  - 支付回调（微信）：`/api/v2/payments/wechat/notify`、`/refund-notify`（无需鉴权，微信服务器调用）

---

## 二、通用规范

### 2.1 请求
- Base URL：`https://<API_BASE_PROD>/api/v2`（生产 HTTPS 已备案域名）
- 内容类型：`application/json`（除文件上传）
- 鉴权：`Authorization: Bearer <JWT>`
- 时间格式：`ISO 8601`（如 `2026-08-16T10:30:00+08:00`）

### 2.2 统一响应格式
```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "requestId": "uuid",
  "timestamp": 1700000000000
}
```
- `code = 0` 成功；非 0 失败（`data` 为 `null`）。
- 分页响应：`data = { list: [...], total: 100, page: 1, pageSize: 20 }`

### 2.3 错误码规范
| code | HTTP | 说明 |
|---|---|---|
| 0 | 200 | 成功 |
| 1001 | 400 | 参数错误（字段校验失败）|
| 1002 | 401 | 认证失败 / Token 过期 |
| 1003 | 403 | 无权限（角色/资源不匹配）|
| 1004 | 404 | 资源不存在 |
| 1005 | 409 | 状态冲突（乐观锁 version 不匹配 / 幂等拒绝）|
| 2001 | 404 | 订单不存在 |
| 2002 | 409 | 订单状态不允许此操作 |
| 2003 | 422 | 支付失败（渠道返回失败）|
| 2004 | 422 | 退款失败 |
| 3001 | 404 | 供应商不存在 |
| 3002 | 422 | 供应商资质过期 |
| 3003 | 422 | 供应商无此业务能力（module 不在 capabilities）|
| 3004 | 409 | 派单冲突（无有效可派供应商）|
| 4001 | 404 | 结算单不存在 |
| 4002 | 409 | 结算已确认，不可修改 |
| 4003 | 409 | 结算已付款，不可重复付款 |
| 5000 | 500 | 服务内部错误 |

### 2.4 认证与鉴权
| 角色 | Token 类型 | Guard | 有效期 |
|---|---|---|---|
| 企业客户 | `JWT(user)` | `UserJwtGuard` | 7 天 |
| 平台运营 | `JWT(admin)` | `AdminJwtGuard` | 24h |
| 财务 | `JWT(admin, role=finance)` | `AdminJwtGuard` + 角色装饰器 | 24h |
| 供应商 | `JWT(supplier)` | `SupplierJwtGuard` | 7 天 |

JWT Payload：
```json
{ "sub": "<user_id|admin_id|supplier_id>", "type": "user|admin|supplier", "role": "admin|finance|operator", "exp": 1700000000 }
```
- 解析后的身份注入 `req.user.id` / `req.user.type`。
- 供应商接口额外校验 `supplier_id` 对应的 `suppliers.status = 'active'` 与资质有效性。

---

## 三、核心数据模型与状态机

### 3.1 统一订单 `orders`（五维状态）
```text
orders
├─ order_no          订单号（唯一，业务主键，如 SE20260816XXXX）
├─ module            seal | newspaper | bookkeeping
├─ user_id           下单企业客户
├─ 维度1 order_status     created/pending_payment/paid/processing/completed/cancelled/closed
├─ 维度2 payment_status   unpaid/paid/partial_refund/full_refund
├─ 维度3 fulfillment_status pending_assignment/assigned/accepted/processing/delivering/signed/completed
├─ 维度4 refund_status    none/applying/partial_refund/full_refund/rejected
├─ 维度5 invoice_status   not_required/pending/processing/issued/failed
├─ total_amount / discount_amount / pay_amount / paid_amount / refund_amount  金额（DECIMAL(18,2)）
├─ address_snapshot  JSONB（收货地址快照）
├─ version           乐观锁（每次写 +1）
└─ deleted_at        软删除
```

### 3.2 订单状态机（五维联动）
```text
                  [created]
                     │ 用户下单
                     ▼
            [pending_payment]  ──(超时未付/用户取消)──▶ [cancelled]
                     │ 支付成功回调
                     ▼
                  [paid]  order_status=paid, payment_status=paid
                     │ 系统/人工派单 → fulfillment_order 创建
                     ▼
           [fulfillment_status 流转]
   pending_assignment → assigned → accepted → processing → delivering → signed → completed
                     │                                              │
                     │ 售后/质量问题                                  ▼
                     │                                         [completed]（可触发退款）
                     │                                          │
              [processing] ◀── refund_status=applying ─────────┘
                     │
                [closed]（退款完成/纠纷关闭）
```
**状态约束（写库前校验）**：
- 仅 `pending_payment` 可取消（→ `cancelled`）。
- 仅 `paid` 且 `fulfillment_status=pending_assignment` 可发起派单。
- `fulfillment_status` 由履约域事件驱动，订单主表只镜像当前履约态。
- `refund_status=applying` 期间 `order_status` 锁定为 `processing`，禁止重复支付/确认收货。

### 3.3 多次派单状态机（`fulfillment_assignments`）
```text
每次派单 = 一条 fulfillment_assignments 记录，status:
  pending → accepted → processing → completed
  pending → rejected（附 reject_reason）
  任意有效态 → cancelled（改派时旧记录标记 cancelled，cancel_remark=改派原因）
  任意有效态 → reassigned（链到 previous_id 指向前一条）

约束：每个 fulfillment_order 同一时刻仅一条 active 记录（部分唯一索引
  idx_fulfillment_assignments_active WHERE status IN (pending,accepted,processing)）。
previous_id 形成派单链，便于追溯「为何换供应商」。
```

### 3.4 退款状态机（`refund_orders`）
```text
applied → approved → processing(微信退款中) → completed
applied → rejected
（支持全额/部分退款；partial_refund 后订单 refund_status=partial_refund，可再次退款直至 full_refund）
```

### 3.5 结算状态机（`settlement_records`）
```text
draft(生成) → confirmed(运营确认金额) → paid(财务付款) → (终态)
rejected（确认阶段驳回，回到 draft 可重算）
约束：confirmed 后不可改明细；paid 后不可重复付款（幂等）。
```

---

## 四、用户端 API（`/api/v2/user`）

> 全部需 `UserJwtGuard`。`user_id` 取自 JWT，不接收前端传入。

### 4.1 微信登录
`POST /auth/wechat-login`
```jsonc
// Request
{ "code": "微信登录 code" }
// Response data
{
  "token": "JWT",
  "user": { "id":"uuid", "openid":"...", "phone":null, "companyName":null, "avatarUrl":null }
}
```
- 首次登录自动创建 `users` 记录（openid 唯一）。
- `phone` 通过后续 `PUT /profile` 或 `wx.login` 手机号授权补全。

### 4.2 用户信息
`GET /profile` → `{ id, openid, phone, companyName, contactName, avatarUrl, createdAt }`
`PUT /profile`
```jsonc
{ "phone":"138xxxx", "companyName":"成都XX公司", "contactName":"张三", "avatarUrl":"https://..." }
```

### 4.3 收货地址
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/addresses` | 列表（含 isDefault）|
| POST | `/addresses` | `{ receiverName, receiverPhone, province, city, district, address, isDefault? }` |
| PUT | `/addresses/:id` | 同上字段（可部分更新）|
| DELETE | `/addresses/:id` | 软删除 |

- 下单时地址快照写入 `orders.address_snapshot`，后续改地址不影响历史订单。

### 4.4 订单列表
`GET /orders`
```text
Query: ?tab=all|pending_payment|paid|processing|completed|after_sale
       &module=seal|newspaper|bookkeeping (可选)
       &page=1&pageSize=20
```
- `tab` 映射：
  - `pending_payment` → `order_status=pending_payment`
  - `paid` → `order_status=paid & fulfillment_status in (pending_assignment,assigned,accepted,processing)`
  - `processing` → `fulfillment_status in (delivering,signed) OR refund_status=applying`
  - `completed` → `order_status=completed`
  - `after_sale` → `refund_status in (applying,partial_refund,full_refund)`
- 响应 `list` 每项：`{ orderNo, module, orderStatus, paymentStatus, fulfillmentStatus, refundStatus, totalAmount, createdAt, items:[{name,count,thumbnail}] }`

### 4.5 订单详情
`GET /orders/:orderNo`
```jsonc
{
  "order": {
    "orderNo":"SE2026...", "module":"seal", "orderStatus":"paid",
    "paymentStatus":"paid", "fulfillmentStatus":"accepted", "refundStatus":"none",
    "invoiceStatus":"not_required",
    "totalAmount":"150.00", "payAmount":"150.00", "paidAmount":"150.00",
    "addressSnapshot": { "receiverName":"张三","receiverPhone":"138...","province":"四川","city":"成都","district":"武侯区","address":"..." },
    "customerRemark":null, "createdAt":"2026-08-16T...", "paidAt":"2026-08-16T..."
  },
  "details": { /* seal_order_details 或 newspaper_order_details */ },
  "fulfillment": {
    "fulfillmentNo":"FL2026...", "supplierName":"XX刻章店", "status":"accepted",
    "acceptedAt":"...", "chain":[ { "supplierName":"A","status":"rejected","rejectReason":"产能不足" }, { "supplierName":"B","status":"accepted" } ]
  },
  "events": [ { "eventType":"ORDER_CREATED","createdAt":"..." }, { "eventType":"PAYMENT_SUCCESS",... } ],
  "logistics": null   // 发货后填充 trackingNo / courier
}
```

### 4.6 创建订单
`POST /orders/seal` / `POST /orders/newspaper` / `POST /orders/bookkeeping`
```jsonc
// 刻章示例 POST /orders/seal
{
  "addressId": "uuid",                 // 或内联 address 对象
  "items": [ { "sealPackageId":"uuid", "sealCount":1, "sealTypes":["公章","财务章"] } ],
  "companyName":"成都XX公司", "legalPerson":"李四", "licenseRegion":"成都",
  "filingRequired": true, "customerRemark":"加急"
}
// 响应
{ "orderNo":"SE2026...", "totalAmount":"150.00", "needPay": true }
```
- 金额由**后端按套餐/单价重新计算**（前端价格不可信），与 bookkeeping 经 URL 传参场景同样需后端校验。
- 创建即写 `order_events(ORDER_CREATED)`，初始 `order_status=pending_payment`。
- `needPay=false`（如 0 元）则直接置 `paid`。

### 4.7 获取支付参数
`POST /orders/:orderNo/pay`
```jsonc
// Request { "paymentMethod":"wechat" }  // 默认 wechat
// Response data
{
  "paymentNo":"PAY2026...",
  "params": { "timeStamp":"...","nonceStr":"...","package":"prepay_id=...","signType":"MD5","paySign":"..." }
}
```
- 幂等：同一 `orderNo` 重复调用返回同一 `paymentNo`（已存在 `pending` 支付单则复用，不重复下单微信）。
- 仅 `order_status=pending_payment` 可发起；已 `paid` 返回 `code=2002`。

### 4.8 取消订单
`POST /orders/:orderNo/cancel`
```jsonc
{ "reason":"不想要了" }
```
- 仅 `pending_payment` 可取消（→ `cancelled`，`cancelledAt` 记录，写 `order_events(ORDER_CANCELLED)`）。
- 已支付订单取消需走退款流程（4.10），不接受此接口。

### 4.9 确认收货
`POST /orders/:orderNo/confirm`
- 仅 `fulfillment_status=signed` 可确认（→ `completed`，`completedAt` 记录，写 `order_events(ORDER_SIGNED/COMPLETED)`）。
- 确认后开放评价 / 发票申请入口。

### 4.10 退款申请
`POST /orders/:orderNo/refund`
```jsonc
{ "reason":"刻错章", "amount":"150.00", "items":["公章"], "evidence":["https://img1","https://img2"] }
```
- 仅 `payment_status=paid` 且未全额退款可发起。
- 创建 `refund_orders(status=applied)`，订单 `refund_status=applying`。
- 部分退款：`amount < paidAmount` → 退后 `refund_status=partial_refund`，可再次申请至 `full_refund`。

### 4.11 发票
`GET /invoices` 列表；`POST /invoices`
```jsonc
{ "orderNo":"SE2026...", "type":"personal|company", "title":"个人/公司名", "taxNo":"（公司必填）", "email":"接收邮箱" }
```
- 仅 `order_status=completed` 可申请；置 `invoice_status=pending`。

---

## 五、供应商端 API（`/api/v2/supplier`）

> 全部需 `SupplierJwtGuard`。`supplier_id` 取自 JWT。

### 5.1 登录与资料
- `POST /auth/login`：`{ username, password }` → `{ token, supplier:{id,name,status,modules:["seal"]} }`
- 首次登录强制改密（明文密码历史迁移风险，见里程碑 1）。
- `GET /profile`：供应商资料 + `supplier_capabilities`（支持业务线）+ `supplier_metrics`（绩效）。

### 5.2 订单工作台
`GET /orders`
```text
Query: ?status=assigned|accepted|processing|completed
       （assigned=待接单；completed 为历史）
```
- 返回该供应商 `active` 派单对应的订单（通过 `fulfillment_assignments` 当前有效记录关联）。

### 5.3 接单 / 拒单
- `POST /orders/:fulfillmentId/accept` → `fulfillment_assignments.status: pending→accepted`，订单 `fulfillment_status=accepted`，写 `order_events(SUPPLIER_ACCEPTED)`。
- `POST /orders/:fulfillmentId/reject`
  ```jsonc
  { "rejectReason":"产能不足/资质不符" }
  ```
  → `status: pending→rejected`，触发智能改派（见 6.6）或回池。

### 5.4 履约动作
| 方法 | 路径 | 状态流转 | 写事件 |
|---|---|---|---|
| POST | `/orders/:fulfillmentId/start` | accepted→processing | PRODUCTION_STARTED |
| POST | `/orders/:fulfillmentId/filing` | 提交备案 `{ filingNo, filingRegion }` | FILING_COMPLETED |
| POST | `/orders/:fulfillmentId/deliver` | processing→delivering | DELIVERY_CREATED（需 `{ courier, trackingNo }`）|
| POST | `/orders/:fulfillmentId/complete` | delivering→completed | ORDER_COMPLETED（供应商侧标记）|

- `complete` 仅当 `fulfillment_status=delivering`（已发货）可点；用户 `confirm` 后订单终态 `completed`。
- 刻章需同步写 `seal_fulfillment_records`（制作/备案/质检/发货证据链：production photos、filing_no、quality_check photos、delivery tracking）。

### 5.5 结算查看
- `GET /settlements`：该供应商结算单列表（period_start/end、total_amount、order_count、status）。
- `GET /settlements/:id`：结算明细（`settlement_items` 逐订单：order_no、amount、cost）。

---

## 六、管理端 API（`/api/v2/admin`）

> 全部需 `AdminJwtGuard`；财务敏感操作需 `role=finance`。

### 6.1 看板与列表
- `GET /dashboard`：订单量、GMV、待派单数、退款中数、供应商活跃数。
- `GET /orders`：全量筛选（`?orderStatus=&module=&paymentStatus=&refundStatus=&keyword=&dateFrom=&dateTo=`）。
- `GET /orders/:orderNo`：订单详情 + **供应链视图**（派单链 `chain`、供应商、履约记录、支付流水、事件时间线）。

### 6.2 审核
`PUT /orders/:orderNo/review`
```jsonc
{ "result":"approved|rejected", "remark":"材料齐全/缺营业执照" }
```
- 影响 `reviewed_by/reviewed_at/review_result`，写 `order_events(ORDER_REVIEWED)`。
- 仅特定业务（如刻章需资质审核）走此流程；登报一般免审。

### 6.3 派单 / 改派
- `GET /orders/unassigned`：返回 `fulfillment_status=pending_assignment` 且未生成有效派单的订单。
- `POST /orders/:orderNo/assign`
  ```jsonc
  { "supplierId":"uuid", "adminId":"<from JWT>" }
  ```
  → 创建 `fulfillment_orders` + 首条 `fulfillment_assignments(pending)`，订单 `fulfillment_status=assigned`，写 `order_events(ASSIGNMENT_CREATED)`。
- `POST /orders/:orderNo/reassign`
  ```jsonc
  { "supplierId":"uuid", "cancelRemark":"原供应商拒单/产能不足" }
  ```
  → 旧 `active` 派单标记 `cancelled/reassigned` + `previousId` 链，新派单创建（**多次派单核心**）。

### 6.4 供应商管理
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/suppliers` | 列表（含 status、modules）|
| POST | `/suppliers` | 新增（name、contact、region、account）|
| PUT | `/suppliers/:id` | 编辑资料 |
| PUT | `/suppliers/:id/capabilities` | 设置支持业务线 `supplier_capabilities(module,status,priority)` |
| PUT | `/suppliers/:id/licenses` | 维护资质 `supplier_licenses(license_type,valid_to)` |
| GET | `/suppliers/:id/metrics` | `supplier_metrics`（acceptance_rate/rejection_rate/on_time_rate/quality_score）|

### 6.5 结算（财务）
- `GET /settlements`：结算单列表。
- `POST /settlements/generate`
  ```jsonc
  { "supplierId":"uuid", "periodStart":"2026-08-01", "periodEnd":"2026-08-31" }
  ```
  → 汇总该供应商周期内 `completed` 订单（多订单汇总），生成 `settlement_records(draft)` + `settlement_items`（逐订单 cost_price 汇总），写 `admin_operation_logs`。
- `PUT /settlements/:id/confirm`：运营确认金额（→ `confirmed`，`confirmed_at`），写审计。
- `POST /settlements/:id/pay`
  ```jsonc
  { "payoutChannel":"bank", "payoutAccount":"...", "operatorId":"<finance JWT>" }
  ```
  → 创建 `supplier_payouts(paid)` + 结算单 `status=paid, paid_at`，写 `admin_operation_logs(SETTLEMENT_PAID)`。
  - 幂等：已 `paid` 返回 `code=4003`。

### 6.6 智能派单（系统自动）
- 订单 `paid` 且无有效派单时，由后台任务 / 事件触发 `smartAssign`：
  1. 按 `module` 过滤 `supplier_capabilities(status=active)`；
  2. 排除资质过期（`supplier_licenses.valid_to < now`）；
  3. 按 `dispatch_rules`（权重：距离/评分/负载/优先级）评分，取 Top-N；
  4. 依次派单，首个 `accepted` 即锁定；全部 `rejected` 则回人工池（`GET /orders/unassigned`）。
- 派单规则：`GET/PUT /dispatch/rules`（JSONB `rule_config`：各维度权重）。

### 6.7 退款审批
- `GET /refunds`：退款申请列表（`status=applied`）。
- `POST /refunds/:id/approve`：→ `approved`，调用微信退款 API，写 `refund_orders(processing→completed)` + 订单 `refund_status=full/partial_refund` + `payment_status` 同步。
- `POST /refunds/:id/reject`：`{ reason }` → `rejected`，订单 `refund_status=rejected`。

### 6.8 审计与配置
- `GET /audit-logs`：`admin_operation_logs`（target_type/target_id/action/admin_id）。
- `GET /dispatch/rules` / `PUT /dispatch/rules`：派单规则配置。

---

## 七、支付域 API（微信支付）

### 7.1 获取支付参数（用户端调用，见 4.7）
`POST /api/v2/user/orders/:orderNo/pay` → 返回 JSAPI 支付参数。
- 后端流程：查 `orders`（校验 `pending_payment`）→ 查/建 `payment_orders(payment_no, amount, status=pending, payment_method=wechat)` → 调微信 `unifiedorder` → 存 `prepay_id/nonce_str/payment_params` → 返回签名参数。
- **幂等**：`payment_no` 唯一；同一订单重复请求返回已有 `pending` 支付单参数，不重复下单。

### 7.2 支付成功回调（微信服务器调用，免鉴权）
`POST /api/v2/payments/wechat/notify`
```jsonc
// 微信推送 XML/JSON（含 transaction_id, out_trade_no=payment_no, total_fee）
// 处理：
//   1. 验签（微信证书 / APIv3 密钥）
//   2. 按 payment_no 查 payment_orders（幂等：已 paid 直接返回 SUCCESS）
//   3. 校验金额一致（防篡改）
//   4. 事务：payment_orders.status=paid + paid_at；
//            orders.order_status=paid, payment_status=paid, paid_at；
//            写 payment_transactions(transaction_no, provider_txn_id, amount, status=success)
//            写 order_events(PAYMENT_SUCCESS)
//   5. 返回 <xml><return_code>SUCCESS</return_code></xml>
```
- **幂等双保险**：`payment_orders` 以 `payment_no` 唯一；`payment_transactions` 以 `provider_txn_id` 唯一（微信重试不会重复入账）。
- 回调**不依赖客户端**，客户端 `requestPayment` 失败不影响最终入账（轮询/下次进入订单页触发状态同步）。

### 7.3 退款回调
`POST /api/v2/payments/wechat/refund-notify`
- 微信退款结果通知 → 更新 `refund_orders.status=completed`、补 `payment_transactions(refund)`、同步 `orders.refund_status/payment_status`。
- 幂等同 7.2（`provider_txn_id` 唯一）。

---

## 八、状态同步与一致性

### 8.1 事件溯源
- 所有状态变更必须写 `order_events`（event_type/from_status/to_status/operator_type/operator_id）。
- 订单详情页「时间线」直接读 `order_events` 倒序。

### 8.2 乐观锁
- 写 `orders` 时 `WHERE version = :oldVersion`，成功 `version+1`；并发冲突返回 `code=1005`，前端提示刷新。

### 8.3 支付与履约解耦
- `orders` 只镜像履约态；真实履约进度在 `fulfillment_orders/assignments/records`。
- 派单/接单/发货事件通过领域服务同步更新 `orders.fulfillment_status`（单向，避免循环依赖）。

### 8.4 金额精度
- 全程 `DECIMAL(18,2)`，前端传参与响应均为字符串（避免浮点误差）。
- 退款金额 ≤ `paid_amount - 已退金额`（后端校验，防超退）。

---

## 九、本次 V2.0 迁移注意事项（实施约束）

1. **目录表非订单**：`newspapers`/`bookkeeping_packages` 是套餐目录，迁移已确认仅 `seal_orders` 35 条为真实订单（见《V2.0 步骤三迁移报告》）。
2. **`order_items` 表结构待对齐 V2.0**（UUID + FK→orders），当前仍为 V1 旧结构；API 阶段需重建并迁移 33 条明细。
3. **支付/履约旧表（payment_orders/refund_orders/fulfillment_orders 等）为 DDD 阶段 text 结构**，与 V2.0 UUID 设计冲突，需在 API 阶段重建（均为空表，无数据负担）。
4. **发版阻塞项**：`API_BASE_PROD` 须换真实 HTTPS 域名 + 微信支付/订阅消息白名单；协议测试数据（address/phone）需业务确认。
5. **认证**：V2.0 用三套独立 JWT（user/admin/supplier），生产密钥已配置（`rongcheng-jwt-secret-2024-*`），禁止客户端伪造支付/退款。

---

## 十、API 清单速查（V2.0）

| 域 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 用户 | POST | `/v2/user/auth/wechat-login` | 公开 |
| 用户 | GET/PUT | `/v2/user/profile` | user |
| 用户 | GET/POST/PUT/DELETE | `/v2/user/addresses[/:id]` | user |
| 用户 | GET | `/v2/user/orders` | user |
| 用户 | GET | `/v2/user/orders/:orderNo` | user |
| 用户 | POST | `/v2/user/orders/{seal\|newspaper\|bookkeeping}` | user |
| 用户 | POST | `/v2/user/orders/:orderNo/pay` | user |
| 用户 | POST | `/v2/user/orders/:orderNo/cancel` | user |
| 用户 | POST | `/v2/user/orders/:orderNo/confirm` | user |
| 用户 | POST | `/v2/user/orders/:orderNo/refund` | user |
| 用户 | GET/POST | `/v2/user/invoices[/:id]` | user |
| 供应商 | POST | `/v2/supplier/auth/login` | 公开 |
| 供应商 | GET | `/v2/supplier/profile` | supplier |
| 供应商 | GET | `/v2/supplier/orders` | supplier |
| 供应商 | POST | `/v2/supplier/orders/:fulfillmentId/{accept\|reject\|start\|filing\|deliver\|complete}` | supplier |
| 供应商 | GET | `/v2/supplier/settlements[/:id]` | supplier |
| 管理 | POST | `/v2/admin/auth/login` | 公开 |
| 管理 | GET | `/v2/admin/dashboard` | admin |
| 管理 | GET | `/v2/admin/orders` | admin |
| 管理 | GET | `/v2/admin/orders/:orderNo` | admin |
| 管理 | PUT | `/v2/admin/orders/:orderNo/review` | admin |
| 管理 | GET | `/v2/admin/orders/unassigned` | admin |
| 管理 | POST | `/v2/admin/orders/:orderNo/assign` | admin |
| 管理 | POST | `/v2/admin/orders/:orderNo/reassign` | admin |
| 管理 | GET/POST/PUT | `/v2/admin/suppliers[/:id]` | admin |
| 管理 | PUT | `/v2/admin/suppliers/:id/{capabilities\|licenses}` | admin |
| 管理 | GET | `/v2/admin/suppliers/:id/metrics` | admin |
| 管理 | GET | `/v2/admin/settlements` | admin |
| 管理 | POST | `/v2/admin/settlements/generate` | admin |
| 管理 | PUT | `/v2/admin/settlements/:id/confirm` | admin |
| 管理 | POST | `/v2/admin/settlements/:id/pay` | finance |
| 管理 | GET | `/v2/admin/refunds` | admin |
| 管理 | POST | `/v2/admin/refunds/:id/{approve\|reject}` | admin/finance |
| 管理 | GET | `/v2/admin/audit-logs` | admin |
| 管理 | GET/PUT | `/v2/admin/dispatch/rules` | admin |
| 支付 | POST | `/v2/payments/wechat/notify` | 微信 |
| 支付 | POST | `/v2/payments/wechat/refund-notify` | 微信 |

---

_文档结束。后续随 API 实现补充 request/response 完整字段与 Swagger 注解。_
