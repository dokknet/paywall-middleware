# Dokknet Paywall Middleware

Status: prototype wip

The paywall middleware authorizes access to walled content. It verifies access tokens from
cookies, manages counter tokens and authorizes search spiders based on their IP.

Currently only Cloudflare Workers are supported.

## Usage

Install with:

`npm install @dokknet/paywall-middleware`

Then add this as your Cloudflare worker index.js:

```javascript
import { cfWorker } from 'paywall-middleware'

const DEBUG = false

addEventListener('fetch', event => {
  try {
    const res = cfWorker.handlePaywall(event).catch(handleError)
    event.respondWith(res)
  } catch (e) {
    event.respondWith(handleError(e))
  }
})

function handleError(e) {
  if (DEBUG) {
    new Response(e.message || e.toString(), { status: 500 })
  } else {
    return new Response('Internal Error', { status: 500 })
  }
}
```

## Development

Install dependencies with `yarn install`.
Run unit tests with `yarn test`

Project setup based on [TypeScript library starter](https://github.com/alexjoverm/typescript-library-starter) by [alexjoverm](https://github.com/alexjoverm).
