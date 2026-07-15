// 报纸批量绑定分类
// 将 130 份报纸均匀分配到 7 个公告类型
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
  console.log('✓ 登录成功')

  // 2. 获取分类
  const cats = await req('GET', '/api/newspapers/categories', null, token)
  console.log('✓ 分类 ' + cats.length + ' 个')
  cats.forEach(c => console.log('  ' + c.id.slice(-3) + ' ' + c.name))

  // 3. 获取所有报纸
  const np = await req('GET', '/api/newspapers', null, token)
  const assigned = np.filter(n => n.categoryId).length
  console.log('\n报纸 ' + np.length + ' 份，已分配 ' + assigned + ' 份')

  if (assigned === np.length) {
    console.log('全部已分配，跳过')
    return
  }

  // 4. 均匀分配（轮询）
  let catIdx = 0
  let updated = 0
  let errors = 0
  for (const newspaper of np) {
    if (newspaper.categoryId) continue // 已有分类跳过
    const catId = cats[catIdx % cats.length].id
    catIdx++
    try {
      await req('PUT', '/api/newspapers/' + newspaper.id, { categoryId: catId }, token)
      updated++
      if (updated % 20 === 0) console.log('  已分配 ' + updated + ' 份...')
    } catch (e) {
      errors++
      console.log('  分配失败: ' + newspaper.name + ' ' + e.message)
    }
  }

  console.log('\n完成：新增分配 ' + updated + ' 份，失败 ' + errors + ' 份')

  // 5. 验证
  const np2 = await req('GET', '/api/newspapers', null, token)
  const byCat = {}
  np2.forEach(n => {
    const name = n.category?.name || '未分类'
    byCat[name] = (byCat[name] || 0) + 1
  })
  console.log('\n分配结果：')
  Object.keys(byCat).forEach(k => console.log('  ' + k + ': ' + byCat[k] + ' 份'))
}

main().catch(console.error)
