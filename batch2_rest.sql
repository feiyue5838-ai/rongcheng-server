-- ================================================================
-- V2.0 第二批：其他 21 张表（在 orders 表建好后执行）
-- ================================================================

BEGIN;

-- ---------- admin_operation_logs ----------
CREATE TABLE IF NOT EXISTS admin_operation_logs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id      UUID,
    admin_name    VARCHAR(64),
    action        VARCHAR(64) NOT NULL,
    target_type   VARCHAR(64),
    target_id     VARCHAR(64),
    before_data   JSONB,
    after_data    JSONB,
    ip_address    VARCHAR(64),
    user_agent    VARCHAR(512),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_logs_admin ON admin_operation_logs (admin_id);
CREATE INDEX idx_admin_logs_target ON admin_operation_logs (target_type, target_id);
CREATE INDEX idx_admin_logs_time ON admin_operation_logs (created_at DESC);

-- ---------- supplier_accounts ----------
CREATE TABLE IF NOT EXISTS supplier_accounts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     UUID        NOT NULL,
    username        VARCHAR(64) NOT NULL UNIQUE,
    password_hash   VARCHAR(256) NOT NULL,
    role            VARCHAR(16) NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    status          VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
    last_login_at   TIMESTAMPTZ,
    last_login_ip   VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_supplier_accounts_supplier ON supplier_accounts (supplier_id);
CREATE INDEX idx_supplier_accounts_username ON supplier_accounts (username);

-- ---------- order_addresses ----------
CREATE TABLE IF NOT EXISTS order_addresses (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID,
    user_id         UUID,
    receiver_name   VARCHAR(64) NOT NULL,
    receiver_phone  VARCHAR(32) NOT NULL,
    province        VARCHAR(64),
    city            VARCHAR(64),
    district        VARCHAR(64),
    address         VARCHAR(512) NOT NULL,
    is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_order_addresses_user ON order_addresses (user_id) WHERE user_id IS NOT NULL;

-- ---------- order_materials ----------
CREATE TABLE IF NOT EXISTS order_materials (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID        NOT NULL,
    material_type   VARCHAR(64) NOT NULL,
    material_name   VARCHAR(128) NOT NULL,
    file_url        VARCHAR(512) NOT NULL,
    file_key        VARCHAR(256),
    file_size       BIGINT,
    width           INTEGER,
    height          INTEGER,
    audit_status    VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (audit_status IN ('pending', 'approved', 'rejected')),
    audit_remark    VARCHAR(256),
    audited_by      UUID,
    audited_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_materials_order ON order_materials (order_id);
CREATE INDEX idx_order_materials_audit ON order_materials (audit_status) WHERE audit_status != 'approved';

-- ---------- order_events ----------
CREATE TABLE IF NOT EXISTS order_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID        NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    event_name      VARCHAR(128) NOT NULL,
    from_status     VARCHAR(32),
    to_status       VARCHAR(32),
    operator_type   VARCHAR(16),
    operator_id     UUID,
    operator_name   VARCHAR(64),
    description     VARCHAR(512),
    metadata        JSONB       DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_events_order ON order_events (order_id);
CREATE INDEX idx_order_events_type ON order_events (event_type);
CREATE INDEX idx_order_events_time ON order_events (created_at DESC);

-- ---------- seal_order_details ----------
CREATE TABLE IF NOT EXISTS seal_order_details (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID        NOT NULL,
    company_name            VARCHAR(256) NOT NULL,
    legal_person            VARCHAR(64) NOT NULL,
    license_no              VARCHAR(64) NOT NULL,
    license_region          VARCHAR(64),
    license_expiry_date     DATE,
    seal_package_id         UUID,
    seal_package_name       VARCHAR(256),
    seal_count              INTEGER     DEFAULT 1,
    seal_types              TEXT[],
    filing_required         BOOLEAN     NOT NULL DEFAULT TRUE,
    filing_region           VARCHAR(64),
    filing_no               VARCHAR(128),
    filed_at                TIMESTAMPTZ,
    production_requirement  TEXT,
    delivery_requirement    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_seal_details_order ON seal_order_details (order_id);
CREATE UNIQUE INDEX idx_seal_details_order_unique ON seal_order_details (order_id);

-- ---------- newspaper_order_details ----------
CREATE TABLE IF NOT EXISTS newspaper_order_details (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID        NOT NULL,
    newspaper_id        UUID,
    newspaper_name      VARCHAR(128),
    newspaper_code      VARCHAR(32),
    template_id         UUID,
    template_type       VARCHAR(64),
    content             TEXT,
    content_char_count  INTEGER,
    copies              INTEGER     DEFAULT 1,
    publication_date    DATE,
    publication_edition VARCHAR(64),
    publication_proof   VARCHAR(512),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_newspaper_details_order ON newspaper_order_details (order_id);
CREATE UNIQUE INDEX idx_newspaper_details_order_unique ON newspaper_order_details (order_id);

-- ---------- bookkeeping_order_details ----------
CREATE TABLE IF NOT EXISTS bookkeeping_order_details (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID        NOT NULL,
    package_id          UUID,
    package_name        VARCHAR(256),
    taxpayer_type       VARCHAR(32) NOT NULL DEFAULT 'small_scale' CHECK (taxpayer_type IN ('general', 'small_scale')),
    service_period      VARCHAR(32),
    start_date          DATE,
    end_date            DATE,
    company_name        VARCHAR(256),
    business_license_no VARCHAR(64),
    tax_authority       VARCHAR(128),
    accounting_scope    TEXT,
    current_period      INTEGER     DEFAULT 0,
    periods_completed   INTEGER     DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bookkeeping_details_order ON bookkeeping_order_details (order_id);
CREATE UNIQUE INDEX idx_bookkeeping_details_order_unique ON bookkeeping_order_details (order_id);

-- ---------- fulfillment_assignments ----------
CREATE TABLE IF NOT EXISTS fulfillment_assignments (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_order_id  UUID        NOT NULL,
    supplier_id           UUID        NOT NULL,
    supplier_name         VARCHAR(256) NOT NULL,
    assigned_by           VARCHAR(16) NOT NULL DEFAULT 'system' CHECK (assigned_by IN ('system', 'admin')),
    admin_id              UUID,
    admin_name            VARCHAR(64),
    status                VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'processing', 'completed', 'rejected', 'cancelled', 'reassigned')),
    reject_reason         VARCHAR(256),
    remark                VARCHAR(512),
    previous_id           UUID,
    assigned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at           TIMESTAMPTZ,
    rejected_at           TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    cancelled_at          TIMESTAMPTZ,
    cancel_remark         VARCHAR(256)
);
CREATE INDEX idx_fulfillment_assignments_order ON fulfillment_assignments (fulfillment_order_id);
CREATE INDEX idx_fulfillment_assignments_supplier ON fulfillment_assignments (supplier_id);
CREATE INDEX idx_fulfillment_assignments_status ON fulfillment_assignments (status);
CREATE UNIQUE INDEX idx_fulfillment_assignments_active
    ON fulfillment_assignments (fulfillment_order_id)
    WHERE status IN ('pending', 'accepted', 'processing');

-- ---------- seal_fulfillment_records ----------
CREATE TABLE IF NOT EXISTS seal_fulfillment_records (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_order_id    UUID        NOT NULL,
    order_id                UUID        NOT NULL,
    production_started_at   TIMESTAMPTZ,
    production_completed_at TIMESTAMPTZ,
    filing_required         BOOLEAN     NOT NULL DEFAULT TRUE,
    filing_status           VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (filing_status IN ('pending', 'submitted', 'approved', 'rejected')),
    filing_no               VARCHAR(128),
    filing_remark           VARCHAR(256),
    filed_at                TIMESTAMPTZ,
    production_photos       TEXT[],
    filing_photos           TEXT[],
    quality_check_photos    TEXT[],
    delivery_courier        VARCHAR(64),
    delivery_tracking_no    VARCHAR(64),
    delivery_at             TIMESTAMPTZ,
    estimated_delivery_date DATE,
    operator_name           VARCHAR(64),
    operator_phone          VARCHAR(32),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_seal_fulfillment_order ON seal_fulfillment_records (fulfillment_order_id);
CREATE UNIQUE INDEX idx_seal_fulfillment_order_unique ON seal_fulfillment_records (fulfillment_order_id);

-- ---------- supplier_capabilities ----------
CREATE TABLE IF NOT EXISTS supplier_capabilities (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     UUID        NOT NULL,
    module          VARCHAR(32) NOT NULL,
    service_type    VARCHAR(64),
    service_name    VARCHAR(128),
    status          VARCHAR(16) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'removed')),
    priority        INTEGER     NOT NULL DEFAULT 100,
    remark          VARCHAR(256),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_supplier_capabilities_supplier ON supplier_capabilities (supplier_id);
CREATE INDEX idx_supplier_capabilities_module ON supplier_capabilities (module, status);
CREATE UNIQUE INDEX idx_supplier_capabilities_unique
    ON supplier_capabilities (supplier_id, module, service_type)
    WHERE service_type IS NOT NULL;
CREATE UNIQUE INDEX idx_supplier_capabilities_module_only
    ON supplier_capabilities (supplier_id, module)
    WHERE service_type IS NULL;

-- ---------- supplier_licenses ----------
CREATE TABLE IF NOT EXISTS supplier_licenses (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id         UUID        NOT NULL,
    license_type        VARCHAR(64) NOT NULL,
    license_name        VARCHAR(128) NOT NULL,
    license_no          VARCHAR(128),
    issuing_authority   VARCHAR(256),
    valid_from          DATE,
    valid_to            DATE,
    file_url            VARCHAR(512),
    file_key            VARCHAR(256),
    status              VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'verified', 'expired', 'rejected')),
    verified_by         UUID,
    verified_at         TIMESTAMPTZ,
    verify_remark       VARCHAR(256),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_supplier_licenses_supplier ON supplier_licenses (supplier_id);
CREATE INDEX idx_supplier_licenses_type ON supplier_licenses (license_type);
CREATE INDEX idx_supplier_licenses_valid ON supplier_licenses (valid_to) WHERE valid_to IS NOT NULL;

-- ---------- supplier_metrics ----------
CREATE TABLE IF NOT EXISTS supplier_metrics (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id             UUID        NOT NULL,
    metric_date             DATE        NOT NULL,
    total_orders            INTEGER     NOT NULL DEFAULT 0,
    completed_orders        INTEGER     NOT NULL DEFAULT 0,
    cancelled_orders        INTEGER     NOT NULL DEFAULT 0,
    acceptance_rate         DECIMAL(5,2) NOT NULL DEFAULT 0,
    rejection_rate          DECIMAL(5,2) NOT NULL DEFAULT 0,
    on_time_rate            DECIMAL(5,2) NOT NULL DEFAULT 0,
    avg_accept_time_minutes DECIMAL(10,2),
    avg_fulfill_time_hours  DECIMAL(10,2),
    avg_delivery_time_hours DECIMAL(10,2),
    complaints              INTEGER     NOT NULL DEFAULT 0,
    refund_count            INTEGER     NOT NULL DEFAULT 0,
    refund_rate             DECIMAL(5,2) NOT NULL DEFAULT 0,
    quality_score           DECIMAL(3,2) NOT NULL DEFAULT 5.00,
    customer_rating         DECIMAL(3,2) NOT NULL DEFAULT 5.00,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_supplier_metrics_unique
    ON supplier_metrics (supplier_id, metric_date);
CREATE INDEX idx_supplier_metrics_supplier ON supplier_metrics (supplier_id);
CREATE INDEX idx_supplier_metrics_date ON supplier_metrics (metric_date DESC);

-- ---------- supplier_payouts ----------
CREATE TABLE IF NOT EXISTS supplier_payouts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_no           VARCHAR(32) NOT NULL UNIQUE,
    supplier_id         UUID        NOT NULL,
    supplier_name       VARCHAR(256) NOT NULL,
    settlement_id       UUID,
    amount              DECIMAL(18,2) NOT NULL,
    bank_name           VARCHAR(128),
    bank_account_name   VARCHAR(256),
    bank_account_no     VARCHAR(64),
    payment_method      VARCHAR(32) NOT NULL CHECK (payment_method IN ('bank_transfer', 'wechat', 'alipay', 'cash')),
    status              VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
    requested_by        UUID,
    requested_at        TIMESTAMPTZ,
    approved_by         UUID,
    approved_at         TIMESTAMPTZ,
    approve_remark      VARCHAR(256),
    paid_by             UUID,
    paid_at             TIMESTAMPTZ,
    transaction_no      VARCHAR(128),
    failure_reason      VARCHAR(256),
    remark              VARCHAR(512),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_supplier_payouts_no ON supplier_payouts (payout_no);
CREATE INDEX idx_supplier_payouts_supplier ON supplier_payouts (supplier_id);
CREATE INDEX idx_supplier_payouts_status ON supplier_payouts (status);
CREATE INDEX idx_supplier_payouts_created ON supplier_payouts (created_at DESC);

-- ---------- invoice_records ----------
CREATE TABLE IF NOT EXISTS invoice_records (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no          VARCHAR(32) UNIQUE,
    order_id            UUID        NOT NULL,
    user_id             UUID        NOT NULL,
    invoice_type        VARCHAR(16) NOT NULL DEFAULT 'normal'
        CHECK (invoice_type IN ('normal', 'vat', 'receipt')),
    buyer_name          VARCHAR(256) NOT NULL,
    buyer_tax_no        VARCHAR(64),
    buyer_bank          VARCHAR(128),
    buyer_bank_account  VARCHAR(64),
    buyer_address       VARCHAR(256),
    buyer_phone         VARCHAR(32),
    invoice_amount      DECIMAL(18,2) NOT NULL,
    tax_rate            DECIMAL(5,4) NOT NULL DEFAULT 0.06,
    tax_amount          DECIMAL(18,2) NOT NULL DEFAULT 0,
    seller_name         VARCHAR(256),
    seller_tax_no       VARCHAR(64),
    status              VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'issued', 'void', 'failed')),
    issued_by           UUID,
    issued_at           TIMESTAMPTZ,
    invoice_file_url    VARCHAR(512),
    invoice_code        VARCHAR(64),
    invoice_number      VARCHAR(64),
    remark              VARCHAR(256),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoice_records_order ON invoice_records (order_id);
CREATE INDEX idx_invoice_records_user ON invoice_records (user_id);
CREATE INDEX idx_invoice_records_status ON invoice_records (status);
CREATE INDEX idx_invoice_records_created ON invoice_records (created_at DESC);

-- ---------- logistics_records ----------
CREATE TABLE IF NOT EXISTS logistics_records (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_order_id  UUID,
    order_id              UUID        NOT NULL,
    courier               VARCHAR(64) NOT NULL,
    tracking_no           VARCHAR(64) NOT NULL,
    sender_name           VARCHAR(64),
    sender_phone          VARCHAR(32),
    sender_address        VARCHAR(512),
    receiver_name         VARCHAR(64) NOT NULL,
    receiver_phone        VARCHAR(32) NOT NULL,
    receiver_province     VARCHAR(64),
    receiver_city         VARCHAR(64),
    receiver_district     VARCHAR(64),
    receiver_address      VARCHAR(512) NOT NULL,
    traces                JSONB       NOT NULL DEFAULT '[]',
    status                VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_transit', 'delivered', 'exception', 'returned')),
    shipped_at            TIMESTAMPTZ,
    delivered_at          TIMESTAMPTZ,
    estimated_days        INTEGER,
    remark                VARCHAR(256),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_logistics_order ON logistics_records (order_id);
CREATE INDEX idx_logistics_tracking ON logistics_records (tracking_no);
CREATE INDEX idx_logistics_status ON logistics_records (status);

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    title           VARCHAR(256) NOT NULL,
    content         TEXT        NOT NULL,
    type            VARCHAR(32) NOT NULL CHECK (type IN ('system', 'order', 'payment', 'promotion')),
    target_type     VARCHAR(32),
    target_id       VARCHAR(64),
    link_url        VARCHAR(512),
    is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications (user_id);
CREATE INDEX idx_notifications_unread ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_target ON notifications (target_type, target_id);
CREATE INDEX idx_notifications_time ON notifications (created_at DESC);

-- ---------- migration_seal_orders_snapshot ----------
CREATE TABLE IF NOT EXISTS migration_seal_orders_snapshot (
    id          UUID        PRIMARY KEY,
    data        JSONB       NOT NULL,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    migrated_to UUID,
    migrated_by VARCHAR(32)
);
CREATE INDEX idx_migration_snap_order ON migration_seal_orders_snapshot (migrated_to) WHERE migrated_to IS NOT NULL;

-- ---------- business_configs ----------
CREATE TABLE IF NOT EXISTS business_configs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key    VARCHAR(64) NOT NULL UNIQUE,
    config_value  TEXT,
    value_type    VARCHAR(16) NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
    description   VARCHAR(256),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_business_configs_key ON business_configs (config_key);

-- ---------- dispatch_rules ----------
CREATE TABLE IF NOT EXISTS dispatch_rules (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    module         VARCHAR(32) NOT NULL,
    service_type   VARCHAR(64),
    rule_name      VARCHAR(128) NOT NULL,
    rule_config    JSONB       NOT NULL DEFAULT '{}',
    priority       INTEGER     NOT NULL DEFAULT 100,
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dispatch_rules_module ON dispatch_rules (module);
CREATE INDEX idx_dispatch_rules_active ON dispatch_rules (is_active) WHERE is_active = TRUE;

-- ---------- 旧表索引补建 ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_assignments_active') THEN
        CREATE UNIQUE INDEX idx_order_assignments_active ON order_assignments (order_id) WHERE is_active = TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_new_order_id') THEN
        CREATE INDEX idx_order_items_new_order_id ON order_items_new (order_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_user_id') THEN
        CREATE INDEX idx_orders_user_id ON orders (user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_suppliers_status_priority') THEN
        CREATE INDEX idx_suppliers_status_priority ON suppliers (status, priority DESC) WHERE status = 'active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_orders_order_id') THEN
        CREATE INDEX idx_payment_orders_order_id ON payment_orders (order_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_orders_status') THEN
        CREATE INDEX idx_payment_orders_status ON payment_orders (status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_transactions_payment_id') THEN
        CREATE INDEX idx_payment_transactions_payment_id ON payment_transactions (payment_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_refund_orders_order_id') THEN
        CREATE INDEX idx_refund_orders_order_id ON refund_orders (order_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_refund_orders_status') THEN
        CREATE INDEX idx_refund_orders_status ON refund_orders (status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_fulfillment_orders_order_id') THEN
        CREATE INDEX idx_fulfillment_orders_order_id ON fulfillment_orders (order_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_fulfillment_orders_supplier_id') THEN
        CREATE INDEX idx_fulfillment_orders_supplier_id ON fulfillment_orders (supplier_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_settlement_orders_supplier_id') THEN
        CREATE INDEX idx_settlement_orders_supplier_id ON settlement_orders (supplier_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_settlement_orders_status') THEN
        CREATE INDEX idx_settlement_orders_status ON settlement_orders (status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_settlement_items_settlement_id') THEN
        CREATE INDEX idx_settlement_items_settlement_id ON settlement_items (settlement_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_settlement_items_order_id') THEN
        CREATE INDEX idx_settlement_items_order_id ON settlement_items (order_id);
    END IF;
END $$ LANGUAGE plpgsql;

-- ---------- 触发器（updated_at 自动更新）----------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'admin_operation_logs','supplier_accounts','order_addresses',
        'order_materials','order_events','seal_order_details',
        'newspaper_order_details','bookkeeping_order_details',
        'fulfillment_assignments','seal_fulfillment_records',
        'supplier_capabilities','supplier_licenses','supplier_metrics',
        'supplier_payouts','invoice_records','logistics_records',
        'notifications','business_configs','dispatch_rules'
    ] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_' || t || '_updated_at') THEN
            EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
        END IF;
    END LOOP;
END $$ LANGUAGE plpgsql;

COMMIT;
