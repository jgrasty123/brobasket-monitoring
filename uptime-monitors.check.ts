import { UrlMonitor, UrlAssertionBuilder, Frequency } from 'checkly/constructs'

/**
 * Free-tier uptime monitors (Hobby plan includes 10 URL monitors @ 2-min freq).
 * These catch hard availability failures: outages, 5xx, broken routing.
 * The browser suite in tests/ covers behavior; these cover "is it up at all".
 */

const pages: Array<[string, string, string]> = [
  ['home', 'Homepage', 'https://thebrobasket.com/'],
  ['collection-men', 'Collection — Gift Baskets for Men', 'https://thebrobasket.com/collections/gift-baskets-for-men'],
  ['cart', 'Cart page', 'https://thebrobasket.com/cart'],
  ['byob', 'Build Your Own Basket', 'https://thebrobasket.com/pages/customize-your-own-gift'],
]

for (const [id, name, url] of pages) {
  new UrlMonitor(`uptime-${id}`, {
    name: `BroBasket Uptime — ${name}`,
    activated: true,
    frequency: Frequency.EVERY_5M,
    locations: ['us-west-1', 'us-east-1'],
    tags: ['brobasket', 'uptime'],
    maxResponseTime: 10_000,
    degradedResponseTime: 5_000,
    request: {
      url,
      skipSSL: false,
      followRedirects: true,
      assertions: [UrlAssertionBuilder.statusCode().equals(200)],
    },
  })
}
