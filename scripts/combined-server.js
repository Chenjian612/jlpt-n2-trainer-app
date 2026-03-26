#!/usr/bin/env node
/**
 * 合并服务器（外网访问专用）
 * - POST /v1/messages  → 转发至 Claude API（代理）
 * - 其他所有请求       → 转发至 Expo dev server（port 8081）
 *
 * 只需一个隧道，app 和 proxy 同域名，无 CORS 问题。
 * 用法: node scripts/combined-server.js
 * 默认监听 http://localhost:8082
 */
const http = require('http');
const https = require('https');

const PORT = 8082;
const EXPO_PORT = 8081;
const ANTHROPIC_HOST = 'api.anthropic.com';

const proxyToExpo = (req, res) => {
  const options = {
    hostname: 'localhost',
    port: EXPO_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${EXPO_PORT}` },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end(`Expo proxy error: ${err.message}`);
  });
  req.pipe(proxyReq);
};

const proxyToClaude = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
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
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  });
  req.pipe(proxyReq);
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v1/messages') {
    proxyToClaude(req, res);
  } else if (req.method === 'OPTIONS' && req.url === '/v1/messages') {
    proxyToClaude(req, res);
  } else {
    proxyToExpo(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`[combined-server] listening on http://localhost:${PORT}`);
  console.log(`[combined-server] /v1/messages → https://${ANTHROPIC_HOST}`);
  console.log(`[combined-server] /* → http://localhost:${EXPO_PORT}`);
});
