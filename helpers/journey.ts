import { expect, Page } from '@playwright/test'

/** Shared PDP → cart steps used by the cart-journey and checkout-shipping checks. */

const COLLECTION = '/collections/gift-baskets-for-men'

let lastProductUrl: string | null = null

export async function openFirstAvailableProduct(page: Page) {
  // Reuse the product found earlier in this run — avoids a second collection
  // crawl (fewer requests, and no bot-challenge risk on repeat visits).
  if (lastProductUrl) {
    await page.goto(lastProductUrl, { waitUntil: 'domcontentloaded' })
    return
  }
  await page.goto(COLLECTION, { waitUntil: 'domcontentloaded' })
  // Skip sold-out tiles (badge shipped May 2026)
  const tiles = page.locator('.product-card, [class*="product-card"]')
  await expect(tiles.first()).toBeVisible()
  const count = Math.min(await tiles.count(), 8)
  for (let i = 0; i < count; i++) {
    const tile = tiles.nth(i)
    if ((await tile.getByText(/sold out/i).count()) === 0) {
      await tile.locator('a[href*="/products/"]').first().click()
      await page.waitForURL(/\/products\//)
      lastProductUrl = page.url()
      return
    }
  }
  throw new Error('No in-stock product tile found on first collection page')
}

export async function addToCartAndOpenDrawer(page: Page) {
  const atc = page
    .locator('form[is="product-form"] button[type="submit"], button[name="add"]')
    .first()
  await expect(atc, 'ATC button visible on PDP').toBeVisible()
  await expect(atc, 'ATC button enabled').toBeEnabled()
  await atc.click()
  // bb-product-addons flow redirects to /cart; native flow opens the drawer.
  await Promise.race([
    page.waitForURL(/\/cart/, { timeout: 20_000 }).catch(() => null),
    page
      .locator('#cart-drawer, cart-drawer')
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => null),
  ])
  if (!/\/cart/.test(page.url())) {
    // Ensure we evaluate cart state on the cart page for a single code path
    await page.goto('/cart', { waitUntil: 'domcontentloaded' })
  }
}


