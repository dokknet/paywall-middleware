import * as m from '../src/cf-worker'
import { getOptions } from '../src/cf-worker'

function makeCookieHeaders(cookieName: string, cookieVal: string) {
  const headers = new Headers()
  headers.append('Cookie', `${cookieName}=${cookieVal}`)
  return headers
}

function makeUARequest(ua: string) {
  const headers = new Headers()
  headers.append('User-Agent', ua)
  return new Request('https://example.com', {headers: headers})
}

describe('Test checkPassthrough', () => {
  it('respects kill switch', () => {
    const request = new Request('https://example.com')
    const options = m.getOptions({ disablePaywall: true })
    const res = m.checkPassthrough(request, options)

    expect(res).toBeTruthy()
  })
  it('blocks html', () => {
    const request = new Request('https://example.com/foo')
    const options = m.getOptions({ allowedCrawlers: [] })

    const res = m.checkPassthrough(request, options)
    expect(res).toBeFalsy()
  })
  it('lets css through', () => {
    const request = new Request('https://example.com/assets/styles.css')
    const res = m.checkPassthrough(request, m.getOptions())
    expect(res).toBeTruthy()
  })
  it('lets crawler through', () => {
    const request = makeUARequest('duckduckbot')
    const options = m.getOptions({ allowedCrawlers: ['google', 'duckduck'] })
    const res = m.checkPassthrough(request, options)
    expect(res).toBeTruthy()
  })
})

describe('Test checkDebugSendPaywall', () => {
  it('returns false on missing cookie', () => {
    const request = new Request('')
    expect(m.checkDebugSendPaywall(request, m.getOptions())).toBeFalsy()
  })
  it('returns true on debug cookie', () => {
    const cookieName = 'foo'
    const cookieVal = 'true'
    const headers = makeCookieHeaders(cookieName, cookieVal)
    const request = new Request('', {headers: headers})
    const options = m.getOptions({ debugSendPaywallCookie: cookieName })

    const res = m.checkDebugSendPaywall(request, options)
    expect(res).toBeTruthy()
  })
})

describe('Test getCookie', () => {
  it('handles missing cookie', () => {
    const request = new Request('')
    expect(m.getCookie(request, '')).toBeNull()
  })
  it('returns cookie value', () => {
    const cookieName = 'foo'
    const cookieVal = 'bar'
    const headers = makeCookieHeaders(cookieName, cookieVal)
    const request = new Request('', {headers: headers})

    expect(m.getCookie(request, cookieName)).toEqual(cookieVal)
  })
})

describe('Test getHtmlRequest', () => {
  it('doesn\'t follow redirect', () => {
    const request = new Request('')
    const res = m.getHtmlRequest(request)
    expect(res.redirect).toEqual('manual')
  })
  it('supports url overwrite', () => {
    const url = 'https://example.com'
    const request = new Request('')
    const res = m.getHtmlRequest(request, url)
    expect(res.url).toEqual(url)
  })
})

describe('Test getPaywallUrl', () => {
  const options = m.getOptions({ paywallPrefix: '/paywall' })
  it('returns prefixed url', () => {
    const url = 'https://example.com/index.html'
    const res = m.getPaywallUrl(options.paywallPrefix, url)
    expect(res).toEqual('https://example.com/paywall/index.html')
  })
  it('handles root objects', () => {
    const url = 'https://example.com/long'
    const res = m.getPaywallUrl(options.paywallPrefix, url)
    expect(res).toEqual('https://example.com/paywall/long')
  })
})

describe('Test stripPathPrefix', () => {
  it('handles root object', () => {
    const path = '/paywall/'
    const res = m.stripPathPrefix('/paywall', path)

    expect(res).toEqual('/')
  })
  it('handles root object without trailing slash', () => {
    const path = '/paywall'
    const res = m.stripPathPrefix('/paywall', path)

    expect(res).toEqual('/')
  })
  it('handles index.html', () => {
    const path = '/paywall/index.html'
    const res = m.stripPathPrefix('/paywall', path)

    expect(res).toEqual('/index.html')
  })
  it('handles nested root object', () => {
    const path = '/paywall/foo/bar'
    const res = m.stripPathPrefix('/paywall', path)

    expect(res).toEqual('/foo/bar')
  })
})

describe('Test isHtml', () => {
  it('handles empty', () => {
    const request = new Request('https://example.com')
    expect(m.isHtml(request)).toBeTruthy()
  })
  it('handles root', () => {
    const request = new Request('https://example.com/')
    expect(m.isHtml(request)).toBeTruthy()
  })
  it('handles html extension', () => {
    const request = new Request('https://example.com/index.html')
    expect(m.isHtml(request)).toBeTruthy()
  })
  it('handles no extension', () => {
    const request = new Request('https://example.com/foo')
    expect(m.isHtml(request)).toBeTruthy()
  })
  it('handles not html extension', () => {
    const request = new Request('https://example.com//html/foo.html/bar.woff2')
    expect(m.isHtml(request)).toBeFalsy()
  })
})

describe('Test isPaywall', () => {
  it('handles empty', () => {
    const request = new Request('https://example.com')
    const res = m.isPaywall(request, getOptions())
    expect(res).toBeFalsy()
  })
  it('handles root', () => {
    const request = new Request('https://example.com/')
    const res = m.isPaywall(request, getOptions())
    expect(res).toBeFalsy()
  })
  it('handles html extension', () => {
    const request = new Request('https://example.com/index.html')
    const res = m.isPaywall(request, getOptions())
    expect(res).toBeFalsy()
  })
  it('handles paywall', () => {
    const request = new Request('https://example.com/paywall')
    const res = m.isPaywall(request, getOptions())
    expect(res).toBeTruthy()
  })
  it('handles paywall/', () => {
    const request = new Request('https://example.com/paywall/')
    const res = m.isPaywall(request, getOptions())
    expect(res).toBeTruthy()
  })
  it('handles paywall/paywall.html', () => {
    const request = new Request('https://example.com/paywall/paywall.html')
    const res = m.isPaywall(request, getOptions())
    expect(res).toBeTruthy()
  })
  it('handles paywall/foo/bar/', () => {
    const request = new Request('https://example.com/paywall/foo/bar/')
    const res = m.isPaywall(request, getOptions())
    expect(res).toBeTruthy()
  })
  it('handles trailing slash in prefix', () => {
    const request = new Request('https://example.com/paywall')
    const options = getOptions({ paywallPrefix: '/paywall/' })
    const res = m.isPaywall(request, options)
    expect(res).toBeTruthy()
  })
  it('handles trailing slash in prefix for paths with trailing slash', () => {
    const request = new Request('https://example.com/paywall/')
    const options = getOptions({ paywallPrefix: '/paywall/' })
    const res = m.isPaywall(request, options)
    expect(res).toBeTruthy()
  })
  it('handles trailing slash in prefix for normal paths', () => {
    const request = new Request('https://example.com/paywall/index.html')
    const options = getOptions({ paywallPrefix: '/paywall/' })
    const res = m.isPaywall(request, options)
    expect(res).toBeTruthy()
  })
})

describe('Test isAllowedCrawler', () => {
  it('handles no UA', () => {
    const request = makeUARequest('')
    const res = m.isAllowedCrawler(request, m.getOptions())
    expect(res).toBeFalsy()
  })
  it('handles no allowed crawlers', () => {
    const request = makeUARequest('')
    const options = m.getOptions({ allowedCrawlers: [] })
    const res = m.isAllowedCrawler(request, options)
    expect(res).toBeFalsy()
  })
  it('handles crawler', () => {
    const request = makeUARequest('duckduckbot')
    const res = m.isAllowedCrawler(request, m.getOptions())
    expect(res).toBeTruthy()
  })
})

