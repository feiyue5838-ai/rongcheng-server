// 子分类 key 全局唯一化迁移（9 个跨分类重复 key）
// 原则：保留语义最贴切分类的原 key，其余加语义后缀；模板 templateType 按 category_id+旧key 精确定位同步改
const { Client } = require('D:/rongcheng-admin/server/node_modules/pg');
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'wuhongyuan198911', database: 'rongcheng' });

// 分类名 -> { 旧key: 新key }（省略 = 不动）
const MAP = {
  '声明公告':   { lost: 'lost_notice', estate: 'estate_notice' },   // company 保留
  '公告声明':   { company: 'company_notice' },
  '表扬信':     { company: 'company_praise', personal: 'personal_praise' },
  '环评公示':   {},                                                  // other 保留
  '登报道歉':   { other: 'other_apology' },                          // personal/corporate 保留
  '宣传稿':     { personal: 'personal_promo', corporate: 'corporate_promo' },
  '身份证挂失': {},                                                  // lost 保留
  '个人证件':   {},                                                  // medical/estate 保留
  '企业证件':   { medical: 'medical_cert' },
};

(async () => {
  await c.connect();
  const catRes = await c.query(`SELECT id, name, sub_types FROM newspaper_categories`);
  const catByName = {};
  for (const row of catRes.rows) catByName[row.name] = row;

  // 预检：映射里的分类都存在
  for (const name of Object.keys(MAP)) {
    if (!catByName[name]) { console.error(`分类不存在: ${name}`); process.exit(1); }
  }

  // 预检：新 key 不与现存 key 冲突
  const existingKeys = new Set();
  for (const row of catRes.rows) {
    for (const s of (row.sub_types || [])) if (s && s.key) existingKeys.add(s.key);
  }
  const newKeys = new Set();
  for (const name of Object.keys(MAP)) {
    for (const oldK of Object.keys(MAP[name])) newKeys.add(MAP[name][oldK]);
  }
  for (const nk of newKeys) {
    if (existingKeys.has(nk)) { console.error(`⚠ 新 key 与现存 key 冲突: ${nk}`); process.exit(1); }
  }
  console.log('预检通过：所有分类存在，新 key 无冲突');

  await c.query('BEGIN');
  let tplUpdated = 0, catUpdated = 0;
  for (const name of Object.keys(MAP)) {
    const map = MAP[name];
    if (Object.keys(map).length === 0) continue;
    const cat = catByName[name];
    const subs = (cat.sub_types || []).map(s => {
      if (s && map[s.key]) { s = { ...s, key: map[s.key] }; }
      return s;
    });
    await c.query(`UPDATE newspaper_categories SET sub_types = $1 WHERE id = $2`, [JSON.stringify(subs), cat.id]);
    catUpdated++;
    for (const [oldK, newK] of Object.entries(map)) {
      const r = await c.query(
        `UPDATE newspaper_templates SET "templateType" = $1 WHERE "templateType" = $2 AND category_id = $3`,
        [newK, oldK, cat.id]
      );
      tplUpdated += r.rowCount;
      console.log(`  ${name}: ${oldK} -> ${newK}（模板 ${r.rowCount} 条）`);
    }
  }
  await c.query('COMMIT');
  console.log(`\n完成：分类 sub_types 更新 ${catUpdated} 个，模板 templateType 更新 ${tplUpdated} 条`);
  await c.end();
})();
