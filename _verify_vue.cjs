const fs = require('fs');
const content = fs.readFileSync('D:/rongcheng-admin/admin/src/views/products/seals.vue', 'utf8');

const checks = [
  ['form.region_prices: {} 初始化', /region_prices:\s*\{\}/],
  ['getRegionPricesRows() 函数', /getRegionPricesRows\s*\(/],
  ['addRegionPrice() 函数', /addRegionPrice\s*\(/],
  ['removeRegionPrice() 函数', /removeRegionPrice\s*\(/],
  // 保存时：行数据 → region_prices 对象（forEach 构建）
  ['行→region_prices: forEach 构建对象', /region_prices\[row\.city\.trim\(\)\]/],
  // 编辑时：region_prices → 行数组（Object.entries）
  ['region_prices→行: Object.entries 遍历', /Object\.entries\(.*\.region_prices/],
  ['无 price_tier_a/b/c 残留', !/price_tier_a|price_tier_b|price_tier_c/.test(content)],
  // createSeal/updateSeal 透传 region_prices
  ['createSeal 传 region_prices', /createSeal\(\{[\s\S]{0,200}region_prices/],
  ['updateSeal 传 region_prices', /updateSeal\(form\.id[\s\S]{0,200}region_prices/],
  // displayPrice 只读展示
  ['displayPrice 只读展示', /displayPrice[^=]|：\{\{.*displayPrice/.test(content)],
];

let pass = 0, fail = 0;
checks.forEach(function([name, test]) {
  var ok = test instanceof RegExp ? test.test(content) : test;
  console.log((ok ? '✓' : '✗') + ' ' + name);
  ok ? pass++ : fail++;
});
console.log('\n结果:', pass + '/' + (pass+fail), fail === 0 ? '✅ 全部通过' : '⚠️ ' + fail + ' 项失败');

// 额外：验证 addRegionPrice / removeRegionPrice 逻辑
var match;
if (match = content.match(/function addRegionPrice[^}]+\}/)) {
  console.log('\naddRegionPrice 逻辑预览:');
  console.log(match[0].slice(0, 200));
}
if (match = content.match(/function removeRegionPrice[^}]+\}/)) {
  console.log('\nremoveRegionPrice 逻辑预览:');
  console.log(match[0].slice(0, 200));
}
