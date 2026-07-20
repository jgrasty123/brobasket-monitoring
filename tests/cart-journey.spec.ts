import { test, expect, Page } from '@playwright/test'

/**
 * BroBasket cart journey — the money path, plus permanent tripwires for
 * every cart bug fixed in 2026:
 *   1. PDP add-to-cart lands a line item in the drawer        (JAVASCRIPT-4H class)
 *   2. Delivery date picker resolves, never stuck "Loading…"  (May 26 fix)
 *   3. Removing the parent product removes its linked
 *      Adult Signature fee — no orphan fees                   (May 26 fix)
 *   4. Checkout handoff reaches Shopify checkout
 * Runs on desktop-chromium AND mobile-safari (@cart tag).
 */

const COLLECTION = '/collections/gift-baskets-for-men'

async function openFirstAvailableProduct(page: Page) {
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
      return
    }
  }
  throw new Error('No in-stock product tile found on first collection page')
}

async function addToCartAndOpenDrawer(page: Page) {
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

test('@cart PDP → cart → checkout with regression tripwires', async ({ page }) => {
  await openFirstAvailableProduct(page)
  await addToCartAndOpenDrawer(page)

  // --- 1. Line item actually visible (the empty-cart bug class) -------------
  const lineItems = page.locator('.line-item, line-item, [class*="line-item"]')
  await expect(lineItems.first(), 'cart shows at least one line item').toBeVisible()

  // --- 2. Date picker must resolve, not hang -------------------------------
  const loadingDates = page.getByText(/loading available dates/i)
  if (await loadingDates.count()) {
    await expect(loadingDates.first(), 'date picker resolved within 20s').toBeHidden({
      timeout: 20_000,
    })
  }

  // --- 3. Orphan adult-signature fee tripwire ------------------------------
  const signatureItem = page.getByText(/adult signature/i).first()
  const hasSignature = (await signatureItem.count()) > 0
  if (hasSignature) {
    // Remove the parent (first non-signature line item)
    const parentRemove = page
      .locator('.line-item, line-item')
      .filter({ hasNotText: /adult signature/i })
      .first()
      .locator('a[href*="quantity=0"], button[aria-label*="emove"], a[aria-label*="emove"]')
      .first()
    await expect(parentRemove, 'remove control on parent line item').toBeVisible()
    await parentRemove.click()
    // Fee must disappear with its parent (May 26 orphan-fee fix)
    await expect(
      page.getByText(/adult signature/i),
      'adult signature fee removed with parent',
    ).toHaveCount(0, { timeout: 15_000 })
    // Restore cart for checkout step
    await openFirstAvailableProduct(page)
    await addToCartAndOpenDrawer(page)
  }

  // --- 4. Checkout handoff --------------------------------------------------
  const checkoutBtn = page
    .locator('button[name="checkout"], a[href*="/checkout"], [data-testid*="checkout"]')
    .first()
  await expect(checkoutBtn, 'checkout CTA visible').toBeVisible()
  await checkoutBtn.click()
  await page.waitForURL(/checkout|\/checkouts\//, { timeout: 30_000 })
  // Never complete a purchase — reaching Shopify checkout is the pass condition.
  await expect(page.locator('body')).toContainText(/contact|delivery|shipping|express/i, {
    timeout: 20_000,
  })
})
