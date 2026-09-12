const assert = require('node:assert/strict');

const baseUrl = new URL(
  process.env.PRODUCTION_URL || 'https://jlpt-n2-trainer-app.pages.dev',
);

async function fetchOk(pathname, label) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.ok, true, `${label} returned HTTP ${response.status}: ${url}`);
  return response;
}

async function main() {
  assert.equal(baseUrl.protocol, 'https:', 'Production URL must use HTTPS.');

  const indexResponse = await fetchOk('/', 'Production index');
  assert.match(indexResponse.headers.get('content-type') || '', /^text\/html\b/i);
  assert.equal(indexResponse.headers.get('x-content-type-options'), 'nosniff');
  const indexHtml = await indexResponse.text();
  const scriptPath = indexHtml.match(/<script[^>]+src="([^"]+)"[^>]*>/i)?.[1];
  assert.ok(scriptPath, 'Production index does not reference an application bundle.');

  const bundleResponse = await fetchOk(scriptPath, 'Application bundle');
  assert.match(bundleResponse.headers.get('content-type') || '', /javascript/i);
  const bundle = await bundleResponse.text();
  for (const marker of ['errorTrackingDays', 'errorEventCountLast14Days', 'errorTrendReady']) {
    assert.equal(bundle.includes(marker), true, `Application bundle is missing release marker: ${marker}`);
  }

  const audioPaths = Array.from(new Set(
    bundle.match(/\/assets\/assets\/audio\/official\/[^"'\\]+\.mp3/g) || [],
  ));
  assert.equal(audioPaths.length, 5, `Expected 5 official audio assets, found ${audioPaths.length}.`);

  const audioSizes = await Promise.all(audioPaths.map(async (audioPath) => {
    const response = await fetchOk(audioPath, `Audio asset ${audioPath}`);
    assert.match(response.headers.get('content-type') || '', /^audio\/(mpeg|mp3)\b/i);
    const bytes = (await response.arrayBuffer()).byteLength;
    assert.ok(bytes > 1000, `Audio asset is unexpectedly small: ${audioPath}`);
    return bytes;
  }));

  console.log(`PASS production index: ${baseUrl.origin}`);
  console.log(`PASS current application bundle: ${scriptPath}`);
  console.log(`PASS official audio assets: ${audioPaths.length} files, ${audioSizes.reduce((sum, size) => sum + size, 0)} bytes`);
}

main().catch((error) => {
  console.error(`FAIL production verification: ${error.message}`);
  process.exitCode = 1;
});
