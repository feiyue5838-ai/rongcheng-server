/**
 * PM2 Ecosystem Config — 荣成后端集群
 */
module.exports = {
  apps: [{
    name: 'rongcheng-api',
    script: 'dist/src/main.js',
    instances: 8,
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
