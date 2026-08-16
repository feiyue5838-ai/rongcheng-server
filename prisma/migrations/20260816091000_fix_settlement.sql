-- 删除旧的 settlement_orders 表（冲突）
DROP TABLE IF EXISTS settlement_records CASCADE;
DROP TABLE IF EXISTS settlement_rules CASCADE;

-- 重新创建 settlement_orders（如果已存在则跳过）
-- settlement_items 现在可以正常创建

CREATE TABLE IF NOT EXISTS settlement_items (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  settlement_id   TEXT NOT NULL,
  order_id        TEXT NOT NULL REFERENCES order_orders(id),
  fulfillment_id  TEXT NOT NULL REFERENCES fulfillment_orders(id),

  order_no        VARCHAR(32),
  order_amount    DECIMAL(10,2) NOT NULL,
  supplier_amount DECIMAL(10,2) NOT NULL,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlement_items_settlement_id ON settlement_items(settlement_id);
CREATE INDEX idx_settlement_items_order_id ON settlement_items(order_id);

COMMENT ON TABLE settlement_items IS '结算明细';
