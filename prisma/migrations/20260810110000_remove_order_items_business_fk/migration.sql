-- 移除 order_items.seal_id / package_id 的外键约束
-- 这两个字段仅作业务标识（前端传 s1-s47 / p1-p7 等业务 id，并非 seals.id / seal_packages.id 的 uuid），
-- 保留外键会导致刻章/套餐下单因外键约束失败（500）。改为普通字段，由应用层（服务端计价）校验业务 id。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'order_items' AND c.conname = 'order_items_seal_id_fkey'
  ) THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_seal_id_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'order_items' AND c.conname = 'order_items_package_id_fkey'
  ) THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_package_id_fkey";
  END IF;
END $$;
