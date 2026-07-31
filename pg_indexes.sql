-- P2 复合索引批量创建
-- 无 downtime（CONCURRENTLY 在 windows PG 不可用，需重启 PG 后执行）
-- 执行后重建 PM2 workers

-- === newspaper_templates：压测最频繁，seq_scan 最多 ===
-- WHERE status = 1 AND category_id = ? AND businessType = ? ORDER BY sort ASC
CREATE INDEX CONCURRENTLY IF NOT EXISTS newspaper_templates_status_category_business_sort
  ON newspaper_templates (status, category_id, business_type, sort);

-- WHERE status = 1 ORDER BY sort ASC（纯列表）
CREATE INDEX CONCURRENTLY IF NOT EXISTS newspaper_templates_status_sort
  ON newspaper_templates (status, sort);

-- === newspapers ===
CREATE INDEX CONCURRENTLY IF NOT EXISTS newspapers_status_sort
  ON newspapers (status, sort);

-- WHERE status = 1 AND region = ? ORDER BY sort ASC
CREATE INDEX CONCURRENTLY IF NOT EXISTS newspapers_status_region_sort
  ON newspapers (status, region, sort);

-- WHERE status = 1 AND category_id = ? ORDER BY sort ASC
CREATE INDEX CONCURRENTLY IF NOT EXISTS newspapers_status_category_sort
  ON newspapers (status, category_id, sort);

-- === seals：高频查询 + N+1 优化后更依赖索引 ===
CREATE INDEX CONCURRENTLY IF NOT EXISTS seals_status_sort
  ON seals (status, sort);

CREATE INDEX CONCURRENTLY IF NOT EXISTS seals_status_category_sort
  ON seals (status, category_id, sort);

-- === seal_packages ===
CREATE INDEX CONCURRENTLY IF NOT EXISTS seal_packages_status_sort
  ON seal_packages (status, sort);

-- === seal_scene_seals：按 scene_id 查印章关联 ===
CREATE INDEX CONCURRENTLY IF NOT EXISTS seal_scene_seals_scene_sort
  ON seal_scene_seals (scene_id, sort);

-- === seal_scenes ===
CREATE INDEX CONCURRENTLY IF NOT EXISTS seal_scenes_status_sort
  ON seal_scenes (status, sort);

-- === newspaper_categories / seal_categories（分类表，小但查询频繁）===
CREATE INDEX CONCURRENTLY IF NOT EXISTS newspaper_categories_status_sort
  ON newspaper_categories (status, sort);

CREATE INDEX CONCURRENTLY IF NOT EXISTS seal_categories_status_sort
  ON seal_categories (status, sort);

-- === seal_scene_packages（场景-套餐关联表）===
CREATE INDEX CONCURRENTLY IF NOT EXISTS seal_scene_packages_scene_sort
  ON seal_scene_packages (scene_id, sort);

-- === personal_doc_items ===
CREATE INDEX CONCURRENTLY IF NOT EXISTS personal_doc_items_status_sort
  ON personal_doc_items (status, sort);

-- === users（登录/查询）===
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_status
  ON users (status);

-- === outlets ===
CREATE INDEX CONCURRENTLY IF NOT EXISTS outlets_status
  ON outlets (status);

-- === orders（各模块共用 order_items）===
CREATE INDEX CONCURRENTLY IF NOT EXISTS seal_orders_status_created
  ON seal_orders (status, created_at DESC);

-- === bookkeeping_packages ===
CREATE INDEX CONCURRENTLY IF NOT EXISTS bookkeeping_packages_status
  ON bookkeeping_packages (status);
