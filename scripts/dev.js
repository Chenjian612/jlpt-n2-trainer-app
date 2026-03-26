#!/usr/bin/env node
/**
 * 一键启动开发环境：Claude 代理 + Expo
 * 用法: npm run dev
 *
 * 启动后访问 http://localhost:8081
 * AI 错题解释功能通过本地代理 http://localhost:9876 转发至 Claude API
 */
const { spawn } = require('child_process');
const path = require('path');

const proxyScript = path.join(__dirname, 'claude-proxy.js');

const proxy = spawn('node', [proxyScript], {
  stdio: 'inherit',
  shell: false,
});

proxy.on('error', (err) => {
  console.error('[dev] 代理启动失败:', err.message);
});

const expo = spawn('npx', ['expo', 'start'], {
  stdio: 'inherit',
  shell: true,
});

expo.on('error', (err) => {
  console.error('[dev] Expo 启动失败:', err.message);
});

const cleanup = () => {
  proxy.kill();
  expo.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
