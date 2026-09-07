// Serve the production export on an OS-assigned port, then run every browser suite.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve('output/web-ci');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
let child;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  });
});

function runSuite(file, baseUrl) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(__dirname, file)], {
      stdio: 'inherit', env: { ...process.env, BASE_URL: baseUrl },
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${file} exited with ${code}`)));
  });
}

async function main() {
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Run npm run build:web:test first.');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    for (const suite of ['component-flows.js', 'dashboard-e2e.js', 'listening-flow.js']) await runSuite(suite, baseUrl);
  } finally {
    server.close();
    server.closeAllConnections();
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  child?.kill(signal);
  server.close();
  server.closeAllConnections();
  process.exit(1);
});
main().catch((error) => { console.error(error); process.exitCode = 1; });
