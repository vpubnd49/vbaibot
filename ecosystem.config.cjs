/**
 * Cấu hình PM2 Production Process Manager cho vbaibot
 * - Tự khởi động lại khi crash
 * - Giới hạn bộ nhớ tối đa (800MB) chống tràn RAM
 * - Ghi log riêng biệt
 */
module.exports = {
  apps: [
    {
      name: "vbaibot",
      script: "dist/src/index.js",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      node_args: "--max-old-space-size=1024",
      env: {
        NODE_ENV: "production",
      },
      error_file: "data/logs/pm2-error.log",
      out_file: "data/logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
