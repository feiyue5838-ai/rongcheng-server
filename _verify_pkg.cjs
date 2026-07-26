process.chdir('D:/rongcheng-admin/server');
const http = require('http');
function req(method, path, data, auth, cb) {
  var d = data ? JSON.stringify(data) : '';
  var h = { 'Content-Type': 'application/json' };
  if (auth) h['Authorization'] = 'Bearer ' + auth;
  if (d) h['Content-Length'] = Buffer.byteLength(d);
  var r = http.request({ host: 'localhost', port: 3001, path: path, method: method, headers: h }, function(res) {
    var s = ''; res.on('data', function(c) { s += c; }); res.on('end', function() {
      try { cb(res.statusCode, JSON.parse(s)); } catch(e) { cb(res.statusCode, s.slice(0, 300)); }
    });
  });
  if (d) r.write(d); r.end();
}
req('POST', '/api/auth/admin/login', { username: 'admin', password: 'admin123' }, '', function(code, r) {
  var tok = r && r.token;
  if (!tok) return console.log('login fail');

  // 测套餐列表（无 region）
  req('GET', '/api/seals/packages', null, tok, function(code2, pkgs) {
    if (!Array.isArray(pkgs)) return console.log('packages not array, code:', code2);
    console.log('=== 套餐列表（无 region）===');
    pkgs.slice(0, 2).forEach(function(p) {
      console.log('  套餐:', p.name, 'price:', p.price);
      if (p.seals) p.seals.slice(0,2).forEach(function(s) {
        console.log('    印章:', s.name, 'price:', s.price, 'displayPrice:', s.displayPrice);
      });
    });

    // 测套餐列表（region=成都市）
    req('GET', '/api/seals/packages?region=%E6%88%90%E9%83%BD%E5%B8%82', null, tok, function(code3, pkgs3) {
      if (!Array.isArray(pkgs3)) return console.log('packages+region error, code:', code3);
      console.log('\n=== 套餐列表（region=成都市）===');
      pkgs3.slice(0, 2).forEach(function(p) {
        console.log('  套餐:', p.name, 'price:', p.price, '(套餐总价不变)');
        if (p.seals) p.seals.slice(0,2).forEach(function(s) {
          var diff = s.displayPrice !== String(s.price) ? ' ✓ (城市价)' : '(fallback)';
          console.log('    印章:', s.name, 'price:', s.price, 'displayPrice:', s.displayPrice, diff);
        });
      });
      process.exit(0);
    });
  });
});
