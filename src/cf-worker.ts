import {} from '@cloudflare/workers-types'
import mime from 'mime-types'

interface Options {
  allowedCrawlers: Array<string>
  debugSendPaywallCookie: string,
  disablePaywall: boolean,
  isWorkersStatic: boolean,
  paywallPrefix: string,
}

export function checkPassthrough(request: Request, options: Options): boolean {
  return (options.disablePaywall ||
    isPaywall(request, options) ||
    !isHtml(request) ||
    isAllowedCrawler(request, options))
}

export function checkDebugSendPaywall(request: Request,
                                      options: Options): boolean {
  const debugSendPaywall = getCookie(request, options.debugSendPaywallCookie)
  return debugSendPaywall === 'true'
}

export async function fetchHtml(request: Request): Promise<Response> {
  const originResponse = await fetch(getHtmlRequest(request))
  // Don't let client cache html
  return rewriteHeader(originResponse, 'Cache-Control', 'no-store')
}

export async function fetchPaywall(request: Request,
                                   options: Options): Promise<Response> {
  const pwUrl = getPaywallUrl(options.paywallPrefix, request.url)
  const pwRequest = getHtmlRequest(request, pwUrl)

  const originResponse = await fetch(pwRequest)
  if (!originResponse.ok) {
    if (isRedirect(originResponse)) {
      // Rewrite Location header to requested resource from paywall resource.
      // Assumes that requests to /paywall* always redirect to a prefix with
      // /paywall.
      const location = originResponse.headers.get('Location')
      const path = stripPathPrefix(options.paywallPrefix, location!)
      return rewriteHeader(originResponse, 'Location', path)
    } else {
      return originResponse
    }
  } else {
    // Don't let client cache html
    return rewriteHeader(originResponse, 'Cache-Control', 'no-store')
  }
}

export function getCookie(request: Request, name: string): string | null {
  let result = null
  const cookieString = request.headers.get('Cookie')
  if (cookieString) {
    let cookies = cookieString.split(';')
    cookies.forEach(cookie => {
      let cookieName = cookie.split('=')[0].trim()
      if (cookieName === name) {
        result = cookie.split('=')[1]
      }
    })
  }
  return result
}

export function getDefaultOptions(): Options {
  return {
    allowedCrawlers: [
      'baidu',
      'bing',
      'duckduck',
      'google',
      'yahoo',
      'yandex'
    ],
    disablePaywall: false,
    isWorkersStatic: false,
    debugSendPaywallCookie: 'DEBUG_SEND_PAYWALL',
    paywallPrefix: '/paywall',
  }
}

export function getHtmlRequest(request: Request, url?: string): Request {
  url = url || request.url
  const init = {
    // We return redirect responses to the client
    redirect: 'manual',
    // Cache html response in CF edge cache if its cache control header
    // indicates that it's cacheable.
    cf: { cacheEverything: true },
  }
  // TODO (abiro) unclear why TypeScript isn't happy with this, it works as
  //  expected.
  // @ts-ignore
  return new Request(url, new Request(request, init))
}

export function getOptions(options?: Partial<Options>): Options {
  return Object.assign(getDefaultOptions(), options)
}

export function getPaywallUrl(paywallPrefix: string,
                              urlString: string): string {
  const url = new URL(urlString)
  url.pathname = paywallPrefix + url.pathname
  return url.toString()
}

/**
 * Handle paywall logic for fetch event.
 *
 * Non-html requests are proxied without modification.
 * Cache-Control is set to "no-store" for html responses (but they are still
 * cached in the Cloudflare CDN if a cache header is present in the origin
 * response).
 *
 * @param event The fetch event.
 * @param options The paywall middleware options.
 * @return The paywall response.
 */
export async function handlePaywall(event: FetchEvent,
                                    options?: Partial<Options>): Promise<Response> {
  const opts = getOptions(options)
  const request = event.request

  if (checkPassthrough(request, opts)) {
    if (isHtml(request)) {
      return fetchHtml(request)
    } else {
      return fetch(request)
    }
  }

  if (checkDebugSendPaywall(request, opts)) {
    return fetchPaywall(request, opts)
  }

  // TODO (abiro) add counter token and access token logic.

  return fetchHtml(request)
}

// TODO (abiro) match based on IP instead of UA
export function isAllowedCrawler(request: Request, options: Options): boolean {
  if (options.allowedCrawlers.length === 0) {
    return false
  }
  const headers = request.headers
  const userAgent = headers.get('User-Agent') || ''
  const crawlers = options.allowedCrawlers.join('|')
  const crawlerRegex = new RegExp(crawlers, 'gi')
  return crawlerRegex.test(userAgent)
}

export function isHtml(request: Request): boolean {
  const url = new URL(request.url)
  const mimeType = mime.lookup(url.pathname)
  // If there is no mime type, assume it's html
  // (eg. example.com/foo will be considered html).
  return !mimeType || mimeType === 'text/html'
}

export function isPaywall(request: Request, options: Options): boolean {
  const url = new URL(request.url)
  const path = url.pathname
  const pref = options.paywallPrefix;
  if (pref[pref.length - 1] === '/')  {
    return path.startsWith(pref) || (path + '/') === pref
  } else {
    return path.startsWith(pref + '/') || path === pref
  }
}

export function isRedirect(response: Response) {
  const s = response.status
  return (s >= 301 && s <= 303) || s === 307 || s === 308
}

export function stripPathPrefix(prefix: string, path: string): string {
  if (!path.startsWith(prefix)) {
    throw new Error(`Path: "${path}" doesn't start with: "${prefix}"`)
  }
  const res = path.slice(prefix.length)
  if (res === '') {
    return '/'
  } else {
    return res
  }
}

export function rewriteHeader(response: Response,
                              header: string,
                              value: string): Response {
  const headers = new Headers(response.headers)
  headers.set(header, value)
  const resInit = {
    headers,
    status: response.status,
    statusText: response.statusText
  }
  return new Response(response.body, resInit)
}

