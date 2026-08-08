/**
 * PM2 Ecosystem Config — 荣成后端集群
 */
module.exports = {
  apps: [{
    name: 'rongcheng-api',
    script: 'dist/src/main.js',
    cwd: 'D:/rongcheng-admin/server',
    instances: 1, // Windows fork 模式
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development',
      PORT: 3001,
    },
    env_production: {
      NODE_ENV: 'production',
    },
    out_file: 'logs/pm2-out-0.log',
    error_file: 'logs/pm2-error-0.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    kill_timeout: 5000,
    wait_ready: false,
    autorestart: true,
  }],
};
