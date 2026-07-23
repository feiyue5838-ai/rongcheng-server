const fs = require('fs');
const path = 'D:/刻章软件/rongcheng-miniprogram/utils/api.js';
let content = fs.readFileSync(path, 'utf8');

// 找到重复定义的位置（module.exports 里的 outletRequest）
// 删除从 "// 网点独立请求函数" 到下一个方法开始之间的内容
const pattern = /(\n  getConfig: \(key\) => request\({ url: '\/api\/config', data: { key } }\),\n\n)\n\/\/ 网点独立请求函数[\s\S]*?(  \/\/ 网点登录（返回 outlet 信息含 openid 绑定状态）)/;

if (pattern.test(content)) {
  content = content.replace(pattern, '$1\n  $2');
  fs.writeFileSync(path, content, 'utf8');
  console.log('已删除重复的 outletRequest 定义');
} else {
  console.log('未找到匹配的重复定义块');
}
