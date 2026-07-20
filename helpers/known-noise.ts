/**
 * Known-noise console/JS error patterns.
 * Mirrors the Sentry inbound-filter list (BroBasket triage, May–Jul 2026).
 * An error matching ANY pattern is ignored by the console sentinel.
 * Keep this list in sync with Sentry → Inbound Filters.
 */
export const KNOWN_NOISE: RegExp[] = [
  /marketingAllowed/i,
  /customerHubRoot/i,
  /recordCounter/i,
  /jdgm\./i,                                   // Judge.me jQuery timing
  /\.raty is not a function/i,
  /easy-bundle/i,                              // EBB remnants
  /dl-app-embed-block/i,                       // Elevar
  /loader\.init-shop-cart-sync/i,
  /AbortError/i,
  /Failed to fetch.*(shopifysvc|consent-tracking-api|shopifycloud)/i,
  /(chrome|moz|safari)-extension:\/\//i,
  /Could not establish connection/i,
  /runtime\.lastError/i,
  /The string did not match the expected pattern/i,
  /translate\.goog/i,                          // Google Translate proxy
  /web-pixels/i,                               // Shopify pixels sandbox
  /trekkie/i,                                  // Shopify analytics (their side)
  /ShopifyElement/i,                           // Shopify web components (their side)
  /build-preview/i,                            // Shopify preview bundle SecurityError
  /Load failed$/i,                             // bare iOS Safari fetch noise (JAVASCRIPT-5)
]

export function isKnownNoise(message: string): boolean {
  return KNOWN_NOISE.some((re) => re.test(message))
}
