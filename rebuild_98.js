/**
 * 重建 98 条「公告声明」e1023e5f 模板
 * 数据源：backup_subkey_dup_20260731.json
 * content：按名称 pattern 自动生成
 */
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('./node_modules/@prisma/client')
const p = new PrismaClient()
const { genContent } = require('./rules')

async function main() {
  const buf = fs.readFileSync('C:/Users/85428/.qclaw/workspace-v733kxt9elzfv7u1/backup_subkey_dup_20260731.json', 'utf8')
  const j = JSON.parse(buf)

  const CAT = 'e1023e5f-90c1-43c1-9e40-bf4ba0ed0a78'

  // 找 e1023 专属的 98 条（DB 完全没有的）
  const existNames = await p.newspaper_templates.findMany({
    where: { name: { in: j.templates.map(t => t.name) } },
    select: { name: true }
  })
  const existSet = new Set(existNames.map(r => r.name))

  const toCreate = j.templates
    .filter(t => t.templateType === 'company' && !existSet.has(t.name))
    .map(t => ({
      id: t.id,
      category_id: CAT,
      name: t.name,
      templateType: t.templateType,
      content: genContent(t.name),
      status: 1,
      sort: 0
    }))

  console.log(`待创建: ${toCreate.length} 条`)

  // 先展示 3 条预览
  console.log('\n=== 预览（前 3 条）===')
  toCreate.slice(0, 3).forEach(t => {
    console.log(`\n--- ${t.name} ---`)
    console.log(t.content)
  })

  // 写入 DB
  let ok = 0, fail = 0
  for (const t of toCreate) {
    try {
      await p.newspaper_templates.create({ data: t })
      ok++
    } catch (e) {
      console.error(`失败: ${t.name} - ${e.message.slice(0, 100)}`)
      fail++
    }
  }

  console.log(`\n=== 创建完成: 成功 ${ok}, 失败 ${fail} ===`)

  // 验证
  const total = await p.newspaper_templates.count({ where: { category_id: CAT, status: 1 } })
  console.log(`e1023 当前模板数: ${total}`)
}

main().finally(() => p.$disconnect()).catch(e => { console.error(e); process.exit(1) })