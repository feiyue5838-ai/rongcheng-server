// Compile TypeScript and restart backend - runs from server directory
const { execSync } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_DIR = 'D:\\rongcheng-admin\\server';

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
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

function waitFor(port, ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // 1. Compile
  console.log('编译 order.service.ts...');
  const tsc = require(path.join(SERVER_DIR, 'node_modules', 'typescript'));
  const tsConfig = JSON.parse(require('fs').readFileSync(path.join(SERVER_DIR, 'tsconfig.json'), 'utf8'));
  const program = tsc.createProgram([path.join(SERVER_DIR, 'src\\modules\\order\\order.service.ts')], {
    ...tsConfig,
    noEmit: false,
    skipLibCheck: true,
  });
  const emitResult = program.emit();
  const diags = tsc.getPreEmitDiagnostics(program);
  const errors = [...diags, ...emitResult.diagnostics].filter(d => d.category === tsc.DiagnosticCategory.Error);
  if (errors.length) {
    errors.forEach(e => console.log(`❌ ${e.file?.fileName}: ${e.messageText}`));
    return;
  }
  console.log('✅ 编译成功');

  // 2. Kill old
  killPort(3001);
  await waitFor(500);

  // 3. Restart
  console.log('启动后端...');
  require('child_process').spawn('node', ['dist/main.js'], {
    cwd: SERVER_DIR,
    detached: true,
    stdio: 'ignore'
  }).unref();
  await waitFor(2500);

  // 4. Health check
  const req = http.get('http://localhost:3001/api/stores', res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(d);
        console.log(json.code === 0 || Array.isArray(json) ? '✅ 后端正常' : `⚠️ ${d.substring(0, 80)}`);
      } catch (e) { console.log(`⚠️ ${d.substring(0, 80)}`); }
    });
  });
  req.on('error', () => console.log('❌ 后端未响应'));
}

main().catch(console.error);
