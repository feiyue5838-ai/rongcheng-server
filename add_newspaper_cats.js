// 补充报纸分类到 16 个，与小程序前端对齐
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

// 16 个分类（与小程序前端对齐）
const CATEGORIES = [
  // 已有 7 个（保留，只更新 sort/icon）
  { id: 'n0000001-0000-0000-0000-000000000001', name: '注销公告', icon: 'cancel', sort: 1 },
  { id: 'n0000001-0000-0000-0000-000000000002', name: '道歉声明', icon: 'apology', sort: 2 },
  { id: 'n0000001-0000-0000-0000-000000000003', name: '法院公告', icon: 'court', sort: 3 },
  { id: 'n0000001-0000-0000-0000-000000000004', name: '拍卖公告', icon: 'auction', sort: 4 },
  { id: 'n0000001-0000-0000-0000-000000000005', name: '证件挂失', icon: 'lost', sort: 5 },
  { id: 'n0000001-0000-0000-0000-000000000006', name: '债权公告', icon: 'creditor', sort: 6 },
  { id: 'n0000001-0000-0000-0000-000000000007', name: '吸收合并公告', icon: 'merger', sort: 7 },
  // 新增 9 个
  { name: '身份证挂失', icon: 'idcard', sort: 8 },
  { name: '个人证件', icon: 'personal', sort: 9 },
  { name: '企业证件', icon: 'company', sort: 10 },
  { name: '发票收据', icon: 'invoice', sort: 11 },
  { name: '真情告白', icon: 'love', sort: 12 },
  { name: '公告声明', icon: 'announce', sort: 13 },
  { name: '政府送达', icon: 'gov', sort: 14 },
  { name: '解除劳动', icon: 'labor', sort: 15 },
  { name: '环评公示', icon: 'env', sort: 16 },
  { name: '登报道歉', icon: 'sorry', sort: 17 },
  { name: '表扬信', icon: 'praise', sort: 18 },
  { name: '宣传稿', icon: 'promo', sort: 19 },
  { name: '招标公告', icon: 'bid', sort: 20 },
]

async function main() {
  // 1. 登录
  const login = await req('POST', '/api/auth/admin/login', { username: 'admin', password: 'admin123' })
  const token = login.token
  console.log('✓ 登录成功\n')

  // 2. 获取现有分类
  const existing = await req('GET', '/api/newspapers/categories', null, token)
  const existingNames = new Set(existing.map(c => c.name))
  console.log('现有 ' + existing.length + ' 个分类：' + Array.from(existingNames).join(', '))

  // 3. 创建缺失的分类
  let created = 0
  for (const cat of CATEGORIES) {
    if (cat.id) {
      // 已有分类，更新 sort/icon
      try {
        await req('PUT', '/api/newspapers/categories/' + cat.id, { sort: cat.sort, icon: cat.icon }, token)
        console.log('✓ 更新: ' + cat.name)
      } catch (e) {
        console.log('✗ 更新失败: ' + cat.name + ' - ' + e.message)
      }
    } else if (!existingNames.has(cat.name)) {
      // 新建分类
      try {
        await req('POST', '/api/newspapers/categories', { name: cat.name, icon: cat.icon, sort: cat.sort, status: 1 }, token)
        created++
        console.log('✓ 创建: ' + cat.name)
      } catch (e) {
        console.log('✗ 创建失败: ' + cat.name + ' - ' + e.message)
      }
    } else {
      console.log('○ 已存在: ' + cat.name)
    }
  }

  console.log('\n完成：新增 ' + created + ' 个分类')

  // 4. 验证
  const all = await req('GET', '/api/newspapers/categories', null, token)
  console.log('\n最终共 ' + all.length + ' 个分类：')
  all.sort((a, b) => a.sort - b.sort).forEach((c, i) => {
    console.log((i + 1) + '. ' + c.name + ' (sort:' + c.sort + ')')
  })
}

main().catch(console.error)
