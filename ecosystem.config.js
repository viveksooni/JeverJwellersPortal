// PM2 process config — run with: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'jever-api',
      script: './apps/server/dist/index.js',
      cwd: '/var/www/jever',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Restart on memory leak (Puppeteer can grow)
      max_memory_restart: '512M',
      // Log config
      out_file: '/var/log/pm2/jever-api.log',
      error_file: '/var/log/pm2/jever-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
