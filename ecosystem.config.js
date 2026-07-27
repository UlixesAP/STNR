module.exports = {
  apps: [
    {
      name: 'tournaments-server',
      script: './server.js',
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3333
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      output: './logs/out.log',
      error: './logs/err.log'
    }
  ]
};
