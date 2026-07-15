// 重新分配 130 份报纸到 20 个分类（轮询均匀分配）
const http = require('http')

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify(body) : null
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = 'Bearer ' + token
    if (b) headers['Content-Length'] = Buffer.byteLength(b)
    const r = http.request({ hostname: 'localhost', port: 3001, path, method, headers }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve(d) } })
    })
    r.on('error', reject)
    if (b) r.write(b)
    r.end()
  })
}

async function main() {
  // 1. 登录
  const login = await req('POST', '/api/auth/admin/login', { username: 'admin', password: 'admin123' })
  const token = login.token
  console.log('✓ 登录成功\n')

  // 2. 获取所有分类
  const cats = await req('GET', '/api/newspapers/categories', null, token)
  console.log('分类 ' + cats.length + ' 个')

  // 3. 获取所有报纸
  const np = await req('GET', '/api/newspapers', null, token)
  console.log('报纸 ' + np.length + ' 份\n')

  // 4. 轮询重新分配（清空现有分类后重新分配）
  let catIdx = 0
  let updated = 0
  let errors = 0

  // 按 sort 排序分类，确保顺序一致
  const sortedCats = cats.sort((a, b) => a.sort - b.sort)

  for (const newspaper of np) {
    const catId = sortedCats[catIdx % sortedCats.length].id
    catIdx++
    try {
      await req('PUT', '/api/newspapers/' + newspaper.id, { categoryId: catId }, token)
      updated++
      if (updated % 20 === 0) console.log('  已分配 ' + updated + ' 份...')
    } catch (e) {
      errors++
      console.log('  分配失败: ' + newspaper.name)
    }
  }

  console.log('\n完成：更新 ' + updated + ' 份，失败 ' + errors + ' 份')

  // 5. 验证分布
  const np2 = await req('GET', '/api/newspapers', null, token)
  const byCat = {}
  np2.forEach(n => {
    const name = n.category?.name || '未分类'
    byCat[name] = (byCat[name] || 0) + 1
  })
  console.log('\n分配结果（20个分类）：')
  Object.keys(byCat).sort().forEach(k => {
    console.log('  ' + k + ': ' + byCat[k] + ' 份')
  })
}

main().catch(console.error)
