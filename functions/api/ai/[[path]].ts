const AI_UPSTREAM_URL =
  'https://jlpt-ai-proxy.08075921888chenjian.workers.dev/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

type PagesRequestContext = {
  request: Request;
};

const jsonResponse = (body: Record<string, unknown>, status: number): Response =>
  Response.json(body, { status, headers: CORS_HEADERS });

export const handleAiProxyRequest = async (
  request: Request,
  fetchUpstream: typeof fetch = fetch,
): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  if (pathname === '/api/ai/health' && request.method === 'GET') {
    return jsonResponse({ status: 'ok' }, 200);
  }

  if (pathname !== '/api/ai/v1/chat/completions') {
    return jsonResponse({ error: 'Not found' }, 404);
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse({ error: 'Content-Type must be application/json' }, 415);
  }

  try {
    const upstream = await fetchUpstream(AI_UPSTREAM_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer proxy',
        'Content-Type': 'application/json',
      },
      body: await request.arrayBuffer(),
    });
    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return jsonResponse({ error: 'AI upstream unavailable' }, 502);
  }
};

export const onRequest = ({ request }: PagesRequestContext): Promise<Response> =>
  handleAiProxyRequest(request);
