#!/usr/bin/env node
/**
 * 本地 Claude API 代理（解决浏览器 CORS 限制）
 * 用法: node scripts/claude-proxy.js
 * 默认监听 http://localhost:3001
 */
const http = require('http');
const https = require('https');

const PORT = 9876;
const ANTHROPIC_HOST = 'api.anthropic.com';

const server = http.createServer((req, res) => {
  // CORS headers — 允许 Expo dev server 跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/v1/messages') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const options = {
    hostname: ANTHROPIC_HOST,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': req.headers['x-api-key'] ?? '',
      'anthropic-version': req.headers['anthropic-version'] ?? '2023-06-01',
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, { 'content-type': 'application/json' });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy] upstream error:', err.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`[claude-proxy] listening on http://localhost:${PORT}`);
  console.log(`[claude-proxy] forwarding POST /v1/messages → https://${ANTHROPIC_HOST}/v1/messages`);
});
