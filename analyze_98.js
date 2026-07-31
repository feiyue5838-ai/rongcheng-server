const fs = require('fs')
const buf = fs.readFileSync('C:/Users/85428/.qclaw/workspace-v733kxt9elzfv7u1/backup_subkey_dup_20260731.json', 'utf8')
const j = JSON.parse(buf)

// 按 templateType 分组打印 name
const groups = {}
j.templates.forEach(t => {
  if (!groups[t.templateType]) groups[t.templateType] = []
  groups[t.templateType].push(t.name)
})

console.log('=== 98 条按 templateType 详细名单 ===')
Object.entries(groups).forEach(([k, names]) => {
  console.log(`\n【${k}】 ${names.length} 条`)
  names.forEach(n => console.log(`  - ${n}`))
})