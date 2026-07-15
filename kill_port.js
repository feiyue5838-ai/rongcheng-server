const { execSync } = require('child_process');
const port = 3001;
try {
  // Find PID holding port
  const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
  const lines = out.trim().split('\n').filter(l => l.includes('LISTENING'));
  console.log('占用端口的进程:');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    console.log('  PID:', pid, '->', line.trim());
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
      console.log(`  已终止 PID ${pid}`);
    } catch (e) {
      console.log(`  终止失败: ${e.message}`);
    }
  }
} catch (e) {
  console.log('查询失败:', e.message);
}
