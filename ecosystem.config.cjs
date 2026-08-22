module.exports = {
  apps: [
    {
      name: "rifitv-frontend",
      cwd: "/var/www/rifitv-v2.0/frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
