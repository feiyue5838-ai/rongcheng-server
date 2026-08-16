-- ================================================================
-- V2.0 第一批：核心 orders 表（无外键依赖，先建）
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS orders (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no            VARCHAR(32) NOT NULL UNIQUE,

    -- 关系
    user_id             UUID        NOT NULL,
    module              VARCHAR(32) NOT NULL,
    service_id          UUID,

    -- 多维状态
    order_status        VARCHAR(16) NOT NULL DEFAULT 'created'
        CHECK (order_status IN (
            'created', 'pending_payment', 'paid', 'processing',
            'completed', 'cancelled', 'closed'
        )),
    payment_status      VARCHAR(16) NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN (
            'unpaid', 'paid', 'partial_refund', 'full_refund'
        )),
    fulfillment_status  VARCHAR(16) NOT NULL DEFAULT 'pending_assignment'
        CHECK (fulfillment_status IN (
            'pending_assignment', 'assigned', 'accepted',
            'processing', 'delivering', 'signed', 'completed'
        )),
    refund_status       VARCHAR(16) NOT NULL DEFAULT 'none'
        CHECK (refund_status IN (
            'none', 'applying', 'partial_refund', 'full_refund', 'rejected'
        )),
    invoice_status      VARCHAR(16) NOT NULL DEFAULT 'not_required'
        CHECK (invoice_status IN (
            'not_required', 'pending', 'processing', 'issued', 'failed'
        )),

    -- 金额（DECIMAL 精确到分）
    total_amount        DECIMAL(18,2) NOT NULL DEFAULT 0,
    discount_amount     DECIMAL(18,2) NOT NULL DEFAULT 0,
    pay_amount          DECIMAL(18,2) NOT NULL DEFAULT 0,
    refund_amount       DECIMAL(18,2) NOT NULL DEFAULT 0,
    paid_amount         DECIMAL(18,2) NOT NULL DEFAULT 0,

    -- 地址快照（JSONB，下单时保存）
    address_snapshot    JSONB,

    -- 备注
    customer_remark     VARCHAR(512),
    admin_remark        VARCHAR(512),

    -- 审核
    reviewed_by         UUID,
    reviewed_at         TIMESTAMPTZ,
    review_result       VARCHAR(16) CHECK (review_result IN ('approved', 'rejected')),

    -- 时间戳
    paid_at             TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancel_reason       VARCHAR(256),

    -- 版本锁（乐观锁）
    version             INTEGER     NOT NULL DEFAULT 1,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE orders IS '统一订单主表（V2.0 核心）';
COMMENT ON COLUMN orders.address_snapshot IS 'JSON：{receiver_name, receiver_phone, province, city, district, address}';
COMMENT ON COLUMN orders.version IS '乐观锁版本号，每次更新 +1';

CREATE INDEX idx_orders_no ON orders (order_no);
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_orders_module ON orders (module);
CREATE INDEX idx_orders_order_status ON orders (order_status);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_fulfillment_status ON orders (fulfillment_status);
CREATE INDEX idx_orders_refund_status ON orders (refund_status);
CREATE INDEX idx_orders_created ON orders (created_at DESC);
CREATE INDEX idx_orders_paid ON orders (paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX idx_orders_multi_status ON orders (module, order_status, payment_status, fulfillment_status, created_at DESC);

COMMIT;
