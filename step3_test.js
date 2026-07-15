const http = require('http');
function get(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3001' + path, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(d.substring(0, 200)); }
      });
    }).on('error', e => resolve('ERROR: ' + e.message));
  });
}
(async () => {
  // 测试 1：场景列表
  const scenes = await get('/api/seals/scenes');
  if (Array.isArray(scenes)) {
    console.log('✅ /api/seals/scenes  OK (' + scenes.length + ' 条)');
    scenes.slice(0, 4).forEach(s => console.log('  [' + s.sort + '] ' + s.name + ' | ' + (s.description || '')));
  } else {
    console.log('❌ /api/seals/scenes 返回非数组: ' + scenes);
  }

  // 测试 2：场景下的印章和套餐
  if (Array.isArray(scenes) && scenes.length > 0) {
    const sceneId = scenes[0].id;
    const products = await get('/api/seals/scenes/' + sceneId);
    if (products.scene) {
      console.log('\n✅ /api/seals/scenes/:id  OK');
      console.log('  场景: ' + products.scene.name);
      console.log('  印章: ' + products.seals.length + ' 个');
      products.seals.slice(0, 3).forEach(s => console.log('    - ' + s.name + ' ¥' + s.price));
      console.log('  套餐: ' + products.packages.length + ' 个');
      products.packages.slice(0, 2).forEach(p => console.log('    - ' + p.name + ' ¥' + p.price));
    } else {
      console.log('❌ /api/seals/scenes/:id 返回: ' + JSON.stringify(products).substring(0, 200));
    }
  }

  // 测试 3：印章分类（验证未破坏）
  const cats = await get('/api/seals/categories');
  console.log('\n' + (Array.isArray(cats) ? '✅' : '❌') + ' /api/seals/categories (' + (Array.isArray(cats) ? cats.length + ' 条)' : ')'));
})();
