-- 迁移：store → outlet (网点)
-- 执行前备份数据

BEGIN;

-- 1. 重命名 stores 表 → outlets
ALTER TABLE stores RENAME TO outlets;

-- 2. 重命名 order_assignments 表中的 store_id → outlet_id
ALTER TABLE order_assignments RENAME COLUMN store_id TO outlet_id;

-- 3. 重命名 delivery_receipts 表中的 store_id → outlet_id
ALTER TABLE delivery_receipts RENAME COLUMN store_id TO outlet_id;

-- 4. 更新外键约束名称（PostgreSQL 会自动处理，但显式声明更清晰）
-- 注意：外键名称可能因 Prisma 生成而不同，需检查实际名称
-- ALTER TABLE order_assignments DROP CONSTRAINT order_assignments_store_id_fkey;
-- ALTER TABLE order_assignments ADD CONSTRAINT order_assignments_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id);

-- ALTER TABLE delivery_receipts DROP CONSTRAINT delivery_receipts_store_id_fkey;
-- ALTER TABLE delivery_receipts ADD CONSTRAINT delivery_receipts_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES outlets(id);

COMMIT;

-- 验证
SELECT 'outlets' AS table_name, COUNT(*) AS count FROM outlets
UNION ALL
SELECT 'order_assignments', COUNT(*) FROM order_assignments
UNION ALL
SELECT 'delivery_receipts', COUNT(*) FROM delivery_receipts;
