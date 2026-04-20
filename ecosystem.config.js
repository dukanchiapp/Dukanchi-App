module.exports = {
  apps: [
    {
      name: 'g-ai-server',
      script: 'npx',
      args: 'tsx server.ts',
      instances: 'max',          // Use all CPU cores
      exec_mode: 'cluster',       // Cluster mode — shares port across workers
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',   // Restart if worker uses more than 1GB RAM
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/g-ai/error.log',
      out_file: '/var/log/g-ai/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    }
  ]
};
