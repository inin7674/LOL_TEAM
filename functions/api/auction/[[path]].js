const DEFAULT_WORKER_ORIGIN = 'https://lolteam.inin7674.workers.dev'

function normalizeOrigin(raw) {
  const value = String(raw || '').trim()
  if (!value) return DEFAULT_WORKER_ORIGIN
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function normalizePathSegment(segment) {
  if (!segment) return ''
  if (Array.isArray(segment)) return segment.join('/')
  return String(segment)
}

function withCors(response, origin) {
  const next = new Response(response.body, response)
  next.headers.set('access-control-allow-origin', origin || '*')
  next.headers.set('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  next.headers.set('access-control-allow-headers', 'content-type,x-room-session')
  next.headers.set('access-control-max-age', '86400')
  return next
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

export async function onRequest(context) {
  const workerOrigin = normalizeOrigin(context.env.AUCTION_WORKER_ORIGIN)
  const pathSegment = normalizePathSegment(context.params.path)
  const nextPath = pathSegment ? `/${pathSegment}` : ''
  const incomingUrl = new URL(context.request.url)
  const query = incomingUrl.search ? incomingUrl.search : ''
  const origin = context.request.headers.get('origin') || '*'

  if (context.request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }), origin)
  }

  // Health endpoint to confirm Pages Functions is deployed and routing /api/auction correctly.
  if (!nextPath) {
    return withCors(json({ ok: true, proxy: true, workerOrigin }), origin)
  }

  const targetUrl = `${workerOrigin}/api/auction${nextPath}${query}`

  const upstreamRequest = new Request(targetUrl, context.request)
  const upstreamResponse = await fetch(upstreamRequest)
  return withCors(upstreamResponse, origin)
}
