module.exports = {
  apps: [
    {
      name: 'hib-course-management',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '600M',
      kill_timeout: 10000,
      time: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
