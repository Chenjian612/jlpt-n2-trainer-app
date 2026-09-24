require('sucrase/register/ts');

const assert = require('node:assert/strict');
const { handleAiProxyRequest } = require('../functions/api/ai/[[path]].ts');

async function main() {
  const health = await handleAiProxyRequest(
    new Request('https://example.pages.dev/api/ai/health'),
  );
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const notFound = await handleAiProxyRequest(
    new Request('https://example.pages.dev/api/ai/unknown'),
  );
  assert.equal(notFound.status, 404);

  let forwardedRequest;
  const response = await handleAiProxyRequest(
    new Request('https://example.pages.dev/api/ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ok' }] }),
    }),
    async (input, init) => {
      forwardedRequest = { input, init };
      return Response.json({ choices: [{ message: { content: 'ok' } }] });
    },
  );

  assert.equal(response.status, 200);
  assert.match(forwardedRequest.input, /workers\.dev\/v1\/chat\/completions$/);
  assert.equal(forwardedRequest.init.method, 'POST');
  assert.equal(forwardedRequest.init.headers.Authorization, 'Bearer proxy');
  assert.deepEqual(
    JSON.parse(Buffer.from(forwardedRequest.init.body).toString('utf8')),
    { messages: [{ role: 'user', content: 'ok' }] },
  );
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await response.json(), {
    choices: [{ message: { content: 'ok' } }],
  });

  const unavailable = await handleAiProxyRequest(
    new Request('https://example.pages.dev/api/ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
    async () => {
      throw new Error('network unavailable');
    },
  );
  assert.equal(unavailable.status, 502);

  console.log('PASS Pages AI relay routing, forwarding, CORS, and failure handling');
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
