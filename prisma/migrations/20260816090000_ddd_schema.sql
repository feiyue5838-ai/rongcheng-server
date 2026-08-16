-- 清理之前创建的表
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS payment_orders CASCADE;
DROP TABLE IF EXISTS order_bookkeeping_details CASCADE;
DROP TABLE IF EXISTS order_newspaper_details CASCADE;
DROP TABLE IF EXISTS order_seal_details CASCADE;
DROP TABLE IF EXISTS order_items_new CASCADE;
DROP TABLE IF EXISTS order_orders CASCADE;

-- 阶段 1：创建统一订单主表
-- 注意：user_id 用 TEXT 类型匹配现有 users 表

-- 1. 创建 order_orders 统一订单主表
CREATE TABLE IF NOT EXISTS order_orders (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_no        VARCHAR(32) UNIQUE NOT NULL,
  user_id         TEXT NOT NULL,

  -- 业务类型
  biz_type        VARCHAR(20) NOT NULL,           -- 'seal'|'newspaper'|'bookkeeping'
  biz_subtype     VARCHAR(50),                     -- 业务子类型

  -- 订单金额
  total_amount    DECIMAL(10,2) NOT NULL,
  pay_amount      DECIMAL(10,2),
  discount_amount DECIMAL(10,2) DEFAULT 0,

  -- 订单状态（统一状态机）
  status          INTEGER NOT NULL DEFAULT 1,      -- 1待支付|2已支付|3制作中|4已发货|5已完成|6已取消|7售后中|8退款中|9已退款
  status_text     VARCHAR(50),

  -- 时间戳
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMP,
  fulfilled_at    TIMESTAMP,
  completed_at    TIMESTAMP,
  canceled_at     TIMESTAMP,

  -- 扩展字段
  remark          TEXT,
  admin_remark    TEXT,

  -- 外键（TEXT 类型）
  CONSTRAINT fk_order_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_order_orders_user_id ON order_orders(user_id);
CREATE INDEX idx_order_orders_biz_type ON order_orders(biz_type);
CREATE INDEX idx_order_orders_status ON order_orders(status);
CREATE INDEX idx_order_orders_created_at ON order_orders(created_at DESC);

-- 2. 创建 order_items 订单明细表
CREATE TABLE IF NOT EXISTS order_items_new (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id        TEXT NOT NULL REFERENCES order_orders(id) ON DELETE CASCADE,
  item_type       VARCHAR(50) NOT NULL,            -- 'seal'|'package'|'service'
  item_id         TEXT,                             -- 关联的业务ID
  name            VARCHAR(200) NOT NULL,
  price           DECIMAL(10,2) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  image           TEXT,
  specs           TEXT,                             -- JSON 规格
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_new_order_id ON order_items_new(order_id);

-- 3. 创建 order_seal_details 刻章业务明细
CREATE TABLE IF NOT EXISTS order_seal_details (
  order_id        TEXT PRIMARY KEY REFERENCES order_orders(id) ON DELETE CASCADE,
  company_name    VARCHAR(200),
  legal_person    VARCHAR(100),
  license_region  VARCHAR(100),
  license_address TEXT,
  seal_reason     TEXT,
  contact_phone   VARCHAR(50),
  legal_phone     VARCHAR(50),
  address_id      TEXT REFERENCES addresses(id),
  address_json    TEXT,
  need_invoice    BOOLEAN DEFAULT false,
  invoice_id      TEXT REFERENCES invoices(id),
  invoice_json    TEXT
);

-- 4. 创建 order_newspaper_details 登报业务明细
CREATE TABLE IF NOT EXISTS order_newspaper_details (
  order_id        TEXT PRIMARY KEY REFERENCES order_orders(id) ON DELETE CASCADE,
  newspaper_id    TEXT,
  section_id      TEXT,
  section_name    VARCHAR(200),
  content         TEXT,
  issue_count     INTEGER DEFAULT 1,
  copy_count      INTEGER DEFAULT 1,
  images          TEXT                              -- JSON 数组
);

-- 5. 创建 order_bookkeeping_details 记账业务明细
CREATE TABLE IF NOT EXISTS order_bookkeeping_details (
  order_id        TEXT PRIMARY KEY REFERENCES order_orders(id) ON DELETE CASCADE,
  package_id      TEXT REFERENCES bookkeeping_packages(id),
  taxpayer_type   VARCHAR(50),
  cycle           VARCHAR(50),
  service_months  INTEGER DEFAULT 12,
  company_name    VARCHAR(200),
  tax_no          VARCHAR(50)
);

-- 6. 创建 payment_orders 支付单
CREATE TABLE IF NOT EXISTS payment_orders (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payment_no      VARCHAR(32) UNIQUE NOT NULL,
  order_id        TEXT NOT NULL REFERENCES order_orders(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount          DECIMAL(10,2) NOT NULL,
  paid_amount     DECIMAL(10,2),

  status          INTEGER NOT NULL DEFAULT 1,      -- 1待支付|2支付中|3已支付|4已退款|5已关闭
  pay_method      VARCHAR(20),                     -- 'wechat'|'alipay'|'balance'
  transaction_id  VARCHAR(100),                    -- 第三方交易号

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMP,
  expired_at      TIMESTAMP,
  notify_data     TEXT                             -- 支付回调原始数据
);

CREATE INDEX idx_payment_orders_order_id ON payment_orders(order_id);
CREATE INDEX idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX idx_payment_orders_status ON payment_orders(status);

-- 7. 创建 payment_transactions 支付交易流水
CREATE TABLE IF NOT EXISTS payment_transactions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payment_id      TEXT NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  transaction_no  VARCHAR(100) UNIQUE,

  amount          DECIMAL(10,2) NOT NULL,
  type            VARCHAR(20) NOT NULL,            -- 'pay'|'refund'
  method          VARCHAR(20),

  status          INTEGER NOT NULL DEFAULT 1,      -- 1待处理|2成功|3失败
  notify_data     TEXT,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX idx_payment_transactions_transaction_no ON payment_transactions(transaction_no);

-- 8. 创建 fulfillment_orders 履约单
CREATE TABLE IF NOT EXISTS fulfillment_orders (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fulfillment_no  VARCHAR(32) UNIQUE NOT NULL,
  order_id        TEXT NOT NULL REFERENCES order_orders(id) ON DELETE CASCADE,
  supplier_id     TEXT NOT NULL,                   -- 暂时不建外键

  status          INTEGER NOT NULL DEFAULT 1,      -- 1待接单|2制作中|3已完成|4已拒绝|5已取消|6已换网点
  status_text     VARCHAR(50),

  assigned_by     TEXT REFERENCES admins(id),
  assigned_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMP,
  completed_at    TIMESTAMP,

  previous_id     TEXT REFERENCES fulfillment_orders(id),
  is_active       BOOLEAN DEFAULT true,
  canceled_at     TIMESTAMP,
  cancel_reason   TEXT,

  -- 交付信息
  delivery_method VARCHAR(20),                     -- 'express'|'self_pickup'
  express_company VARCHAR(50),
  express_no      VARCHAR(100),
  delivered_at    TIMESTAMP,

  -- 签收信息
  signed_by       VARCHAR(100),
  signed_at       TIMESTAMP,
  sign_photo      TEXT,

  remark          TEXT
);

CREATE INDEX idx_fulfillment_orders_order_id ON fulfillment_orders(order_id);
CREATE INDEX idx_fulfillment_orders_supplier_id ON fulfillment_orders(supplier_id);
CREATE INDEX idx_fulfillment_orders_is_active ON fulfillment_orders(is_active) WHERE is_active = true;

-- 9. 创建 suppliers 供应商表
CREATE TABLE IF NOT EXISTS suppliers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            VARCHAR(200) NOT NULL,
  contact         VARCHAR(100),
  phone           VARCHAR(50),
  status          INTEGER DEFAULT 1,

  -- 资质信息
  business_license TEXT,
  special_permits  TEXT,                            -- JSON 数组

  -- 服务区域
  province        VARCHAR(50),
  city            VARCHAR(50),
  district        VARCHAR(50),
  address         TEXT,

  -- 业务类型
  biz_types       TEXT,                             -- JSON ['seal', 'newspaper', 'bookkeeping']

  -- 其他
  priority        INTEGER DEFAULT 0,
  total_orders    INTEGER DEFAULT 0,
  last_login_at   TIMESTAMP,
  last_login_ip   VARCHAR(50),

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_province_city ON suppliers(province, city);

-- 10. 创建 settlement_orders 结算单
CREATE TABLE IF NOT EXISTS settlement_orders (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  settlement_no   VARCHAR(32) UNIQUE NOT NULL,
  supplier_id     TEXT NOT NULL REFERENCES suppliers(id),

  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  total_amount    DECIMAL(10,2) NOT NULL,
  order_count     INTEGER NOT NULL DEFAULT 0,

  status          INTEGER NOT NULL DEFAULT 1,      -- 1待确认|2待付款|3已付款
  confirmed_at    TIMESTAMP,
  paid_at         TIMESTAMP,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlement_orders_supplier_id ON settlement_orders(supplier_id);
CREATE INDEX idx_settlement_orders_status ON settlement_orders(status);
CREATE INDEX idx_settlement_orders_period ON settlement_orders(period_start, period_end);

-- 11. 创建 settlement_items 结算明细
CREATE TABLE IF NOT EXISTS settlement_items (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  settlement_id   TEXT NOT NULL REFERENCES settlement_orders(id) ON DELETE CASCADE,
  order_id        TEXT NOT NULL REFERENCES order_orders(id),
  fulfillment_id  TEXT NOT NULL REFERENCES fulfillment_orders(id),

  order_no        VARCHAR(32),
  order_amount    DECIMAL(10,2) NOT NULL,
  supplier_amount DECIMAL(10,2) NOT NULL,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlement_items_settlement_id ON settlement_items(settlement_id);
CREATE INDEX idx_settlement_items_order_id ON settlement_items(order_id);

-- 12. 创建 refund_orders 退款单
CREATE TABLE IF NOT EXISTS refund_orders (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  refund_no       VARCHAR(32) UNIQUE NOT NULL,
  order_id        TEXT NOT NULL REFERENCES order_orders(id) ON DELETE CASCADE,
  payment_id      TEXT REFERENCES payment_orders(id),

  amount          DECIMAL(10,2) NOT NULL,
  reason          TEXT,

  status          INTEGER NOT NULL DEFAULT 1,      -- 1待审核|2审核通过|3退款中|4已退款|5已拒绝
  approved_by     TEXT REFERENCES admins(id),
  approved_at     TIMESTAMP,
  refunded_at     TIMESTAMP,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refund_orders_order_id ON refund_orders(order_id);
CREATE INDEX idx_refund_orders_status ON refund_orders(status);

-- 注释
COMMENT ON TABLE order_orders IS '统一订单主表';
COMMENT ON TABLE order_items_new IS '订单明细表';
COMMENT ON TABLE order_seal_details IS '刻章业务明细';
COMMENT ON TABLE order_newspaper_details IS '登报业务明细';
COMMENT ON TABLE order_bookkeeping_details IS '记账业务明细';
COMMENT ON TABLE payment_orders IS '支付单';
COMMENT ON TABLE payment_transactions IS '支付交易流水';
COMMENT ON TABLE fulfillment_orders IS '履约单';
COMMENT ON TABLE suppliers IS '供应商（履约供应商）';
COMMENT ON TABLE settlement_orders IS '结算单';
COMMENT ON TABLE settlement_items IS '结算明细';
COMMENT ON TABLE refund_orders IS '退款单';
