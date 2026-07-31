#!/usr/bin/env ts-node
/**
 * Phase 1 迁移脚本：清理 newspaper_templates.businessType 脏数据
 *
 * 功能：将 businessType 非空但 templateType 为空的模板，通过反向查 subTypes 字典
 *       自动补上 templateType 字段。
 *
 * 使用：
 *   干运行（预览）: npx ts-node scripts/migrate_template_business_type.ts --dry-run
 *   执行迁移      : npx ts-node scripts/migrate_template_business_type.ts
 *
 * 决策：
 *   - 自动执行，不二次确认
 *   - 匹配失败的不做处理，保留原 businessType
 */

import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const isDryRun = process.argv.includes('--dry-run')
  console.log(isDryRun ? '🔍 [干运行] 不写入数据库，仅预览' : '🚀 [执行模式] 即将写入数据库')
  console.log('='.repeat(60))

  // ── Step 1: 加载 subTypes 字典 ──────────────────────────────────────
  const cats = await (p as any).newspaper_categories.findMany({
    where: { status: 1 },
    select: { name: true, sub_types: true },
  })

  // 全量扁平列表
  const allSubs: Array<{ key: string; name: string }> = []
  for (const cat of cats) {
    for (const s of (cat.sub_types || [])) {
      if (s.key && s.name) allSubs.push({ key: s.key, name: s.name })
    }
  }

  // nameToKey: subType.name → subType.key（用于精确匹配）
  const nameToKey: Record<string, string> = {}
  for (const s of allSubs) nameToKey[s.name] = s.key

  console.log(`✅ 字典加载完成：${allSubs.length} 个子分类`)
  console.log(`   其中 key===name（中文当 key）：${allSubs.filter(s => s.key === s.name).length} 个`)
  console.log('')

  // 辅助：根据 key 反查 name
  const keyToName: Record<string, string> = Object.fromEntries(allSubs.map(s => [s.key, s.name]))

  // key===name 的中文 key（字典脏数据，标记一下）
  const chineseKeys = new Set(allSubs.filter(s => s.key === s.name).map(s => s.key))

  // ── Step 2: 查找目标行 ─────────────────────────────────────────────
  const dirtyRows: any[] = await (p as any).newspaper_templates.findMany({
    where: { businessType: { not: null }, templateType: null },
    select: { id: true, name: true, businessType: true },
  })
  console.log(`📋 目标模板（businessType 非空 + templateType 为空）：${dirtyRows.length} 条`)
  console.log('')

  if (dirtyRows.length === 0) {
    console.log('✅ 数据已经干净，无需迁移')
    return
  }

  // ── Step 3: 逐条匹配 ───────────────────────────────────────────────
  type Result = 'matched' | 'ambiguous' | 'not_matched'
  interface Plan {
    id: string; name: string; businessType: string
    key: string | null; displayName: string | null; result: Result
  }
  const plans: Plan[] = []

  for (const row of dirtyRows) {
    const bt: string = row.businessType
    let key: string | null = null
    let displayName: string | null = null
    let result: Result = 'not_matched'

    // 1) bt 正好是某个 subType.name → 取该 entry 的 key
    if (nameToKey[bt]) {
      key = nameToKey[bt]
      // 如果 key 本身也是中文（字典脏数据），提示但不阻止
      displayName = chineseKeys.has(key) ? `(中文key)${key}` : bt
      result = chineseKeys.has(key) ? 'ambiguous' : 'matched'
    }
    // 2) bt 正好是某个 subType.key → 取该 entry 的 name（作为参考名）
    else if (keyToName[bt]) {
      key = bt  // 直接用 bt 作为 templateType
      displayName = keyToName[bt]
      result = chineseKeys.has(key) ? 'ambiguous' : 'matched'
    }
    // 3) bt 是某 subType.name 的子串 → 取最短匹配（最精确）
    else {
      const hits = allSubs.filter(s => s.name.includes(bt) || bt.includes(s.name))
      if (hits.length === 1) {
        key = hits[0].key; displayName = hits[0].name; result = 'matched'
      } else if (hits.length > 1) {
        hits.sort((a, b) => a.name.length - b.name.length)
        key = hits[0].key; displayName = hits[0].name; result = 'ambiguous'
      }
    }

    plans.push({ id: row.id, name: row.name, businessType: bt, key, displayName, result })
  }

  const matchedRows = plans.filter(p => p.result === 'matched')
  const ambiguousRows = plans.filter(p => p.result === 'ambiguous')
  const notMatchedRows = plans.filter(p => p.result === 'not_matched')

  console.log('📊 匹配结果统计：')
  console.log(`   ✅ 精确/模糊匹配：${matchedRows.length} 条`)
  console.log(`   ⚠️  多重匹配（取最精确）：${ambiguousRows.length} 条`)
  console.log(`   ❌ 无法匹配（保留原值）：${notMatchedRows.length} 条`)
  console.log('')

  if (notMatchedRows.length > 0) {
    const byValue: Record<string, number> = {}
    for (const r of notMatchedRows) {
      byValue[r.businessType] = (byValue[r.businessType] || 0) + 1
    }
    console.log('❌ 无法匹配的 businessType 值：')
    for (const [v, cnt] of Object.entries(byValue).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${JSON.stringify(v)}  →  ${cnt} 条`)
    }
    console.log('')
  }

  if (matchedRows.length > 0) {
    console.log('✅ 可迁移记录（前 10 条预览）：')
    console.log(`   ID.padEnd(36)  businessType.padEnd(20)  →  templateType`)
    console.log(`   ${'-'.repeat(36)}  ${'-'.repeat(20)}  ${'-'.repeat(20)}`)
    for (const r of matchedRows.slice(0, 10)) {
      console.log(`   ${r.id.padEnd(36)}  ${r.businessType.padEnd(20)}  →  ${r.key}`)
    }
    if (matchedRows.length > 10) console.log(`   ... 还有 ${matchedRows.length - 10} 条`)
    console.log('')
  }

  if (isDryRun) {
    console.log('🔍 干运行完成。执行迁移请运行不带 --dry-run 的版本')
    return
  }

  // ── Step 4: 执行迁移 ───────────────────────────────────────────────
  const toMigrate = [...matchedRows, ...ambiguousRows]
  if (toMigrate.length === 0) {
    console.log('⚠️  没有可迁移的记录，退出')
    return
  }

  console.log(`✅ 自动确认，执行迁移：更新 ${toMigrate.length} 条 templateType...`)

  let ok = 0, fail = 0
  for (const plan of toMigrate) {
    try {
      await (p as any).newspaper_templates.update({
        where: { id: plan.id },
        data: { templateType: plan.key },
      })
      ok++
    } catch (e: any) {
      fail++
      console.log(`   ❌ id=${plan.id}: ${e?.message || e}`)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`✅ 迁移完成：成功 ${ok} 条，失败 ${fail} 条`)
  console.log(`   保留原值（未修改）：${notMatchedRows.length} 条`)
}

main()
  .catch(e => { console.error('Fatal:', e); process.exit(1); })
  .finally(() => p.$disconnect())
