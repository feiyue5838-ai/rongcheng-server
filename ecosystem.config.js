/**
 * PM2 Ecosystem Config — 荣成后端集群
 */
module.exports = {
  apps: [{
    name: 'rongcheng-api',
    script: 'dist/src/main.js',
    instances: 2, // 原为 8：本机内存不足（8 worker 各占 ~140MB + 其他进程 → RAM 94% thrashing），压测反降。生产按 CPU 核数调整
    exec_mode: 'cluster',
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
    },
    out_file: 'logs/pm2-out.log',
    error_file: 'logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000,
  }],
};
