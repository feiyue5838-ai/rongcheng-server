const tsc = require('./node_modules/typescript');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const http = require('http');

const SERVER_DIR = __dirname;

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', cwd: SERVER_DIR });
    const lines = out.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }); console.log(`已终止 PID ${pid}`); } catch (e) {}
      }
    }
  } catch (e) {}
}

async function main() {
  // Compile
  console.log('编译...');
  const tsConfig = JSON.parse(fs.readFileSync(path.join(SERVER_DIR, 'tsconfig.json'), 'utf8'));
  const program = tsc.createProgram(['src/modules/order/order.service.ts'], {
    ...tsConfig, noEmit: false, skipLibCheck: true,
  });
  const emitResult = program.emit();
  const diags = tsc.getPreEmitDiagnostics(program);
  const errors = [...diags, ...emitResult.diagnostics].filter(d => d.category === tsc.DiagnosticCategory.Error);
  if (errors.length) {
    errors.forEach(e => console.log(`编译错误: ${e.file?.fileName}: ${e.messageText}`));
    return;
  }
  console.log('编译成功');

  // Kill old
  killPort(3001);
  await new Promise(r => setTimeout(r, 500));

  // Start new
  console.log('启动后端...');
  require('child_process').spawn('node', ['dist/main.js'], {
    cwd: SERVER_DIR, detached: true, stdio: 'ignore'
  }).unref();
  await new Promise(r => setTimeout(r, 3000));

  // Verify
  const req = http.get('http://localhost:3001/api/stores', res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(d);
        console.log(json.code === 0 || Array.isArray(json) ? '后端正常' : `⚠️ ${d.substring(0, 100)}`);
      } catch (e) { console.log(`⚠️ ${d.substring(0, 100)}`); }
    });
  });
  req.on('error', () => console.log('后端启动失败'));
}

main().catch(console.error);
