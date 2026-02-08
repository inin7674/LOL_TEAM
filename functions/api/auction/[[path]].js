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

export async function onRequest(context) {
  const workerOrigin = normalizeOrigin(context.env.AUCTION_WORKER_ORIGIN)
  const pathSegment = normalizePathSegment(context.params.path)
  const nextPath = pathSegment ? `/${pathSegment}` : ''
  const incomingUrl = new URL(context.request.url)
  const query = incomingUrl.search ? incomingUrl.search : ''
  const targetUrl = `${workerOrigin}/api/auction${nextPath}${query}`

  const upstreamRequest = new Request(targetUrl, context.request)
  return fetch(upstreamRequest)
}
