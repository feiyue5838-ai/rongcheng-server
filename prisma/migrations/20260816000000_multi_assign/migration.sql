-- Migration: 支持订单多次派单
-- 2026-08-16

-- 1. 去掉 order_id 唯一约束（允许同一订单多条派单记录）
DROP INDEX IF EXISTS "order_assignments_order_id_key";

-- 2. 新增字段
ALTER TABLE order_assignments
  ADD COLUMN IF NOT EXISTS is_active     Boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canceled_at   Timestamp,
  ADD COLUMN IF NOT EXISTS cancel_remark String,
  ADD COLUMN IF NOT EXISTS previous_id   String;

-- 3. 现有记录标记为 is_active=true（兼容历史数据）
UPDATE order_assignments SET is_active = true WHERE is_active IS NULL;

-- 4. 重建唯一约束（一个订单最多一个 is_active=true 的记录）
--    PostgreSQL 支持部分唯一索引（只对 is_active=true 的行生效）
CREATE UNIQUE INDEX IF NOT EXISTS order_assignments_order_active
  ON order_assignments (order_id)
  WHERE is_active = true;
