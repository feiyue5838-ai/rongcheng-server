const fs = require('fs')
const { PrismaClient } = require('./node_modules/@prisma/client')
const p = new PrismaClient()

async function main() {
  const buf = fs.readFileSync('C:/Users/85428/.qclaw/workspace-v733kxt9elzfv7u1/backup_subkey_dup_20260731.json', 'utf8')
  const j = JSON.parse(buf)

  // 对 backup 213 条 name，去 DB 全量搜索，看看哪些分类已经有同名模板
  const names = j.templates.map(t => t.name)
  const existInDb = await p.newspaper_templates.findMany({
    where: { name: { in: names } },
    select: { name: true, category_id: true, templateType: true }
  })
  const existMap = {}
  existInDb.forEach(r => { existMap[r.name] = (existMap[r.name] || []).concat([`${r.category_id.slice(0,8)}/${r.templateType}`]) })

  // 找出 e1023 独有（其他分类没有）的
  const onlyInE1023 = []
  for (const t of j.templates) {
    if (!existMap[t.name]) onlyInE1023.push({ name: t.name, type: t.templateType })
  }

  console.log(`=== 213 条里 DB 已有同名（去重后按分类聚合）：${Object.keys(existMap).length} 个 name ===`)
  console.log(`=== 213 条里 DB 完全找不到的：${onlyInE1023.length} 个 ===`)
  onlyInE1023.forEach(t => console.log(`  [${t.type}] ${t.name}`))

  // 按 templateType 汇总
  console.log('\n=== 213 条 name 在 DB 中出现过的（按 templateType）===')
  for (const t of j.templates) {
    if (existMap[t.name]) {
      // ok
    }
  }

  // 按 templateType 找缺
  const typeBuckets = {}
  for (const t of j.templates) {
    if (!typeBuckets[t.templateType]) typeBuckets[t.templateType] = { total: 0, exists: 0, missing: [] }
    typeBuckets[t.templateType].total++
    if (existMap[t.name]) typeBuckets[t.templateType].exists++
    else typeBuckets[t.templateType].missing.push(t.name)
  }
  Object.entries(typeBuckets).forEach(([k, v]) => {
    console.log(`  [${k}] ${v.exists}/${v.total} 已存在，缺 ${v.missing.length}`)
  })
}

main().finally(() => p.$disconnect()).catch(e => { console.error(e.message); process.exit(1) })