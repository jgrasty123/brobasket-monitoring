import { test, expect } from '@playwright/test'
import { openFirstAvailableProduct, addToCartAndOpenDrawer } from '../helpers/journey'

/**
 * BroBasket cart journey — the money path, plus permanent tripwires for
 * every cart bug fixed in 2026:
 *   1. PDP add-to-cart lands a line item in the drawer        (JAVASCRIPT-4H class)
 *   2. Delivery date picker resolves, never stuck "Loading…"  (May 26 fix)
 *   3. Removing the parent product removes its linked
 *      Adult Signature fee — no orphan fees                   (May 26 fix)
 *   4. Checkout handoff reaches Shopify checkout
 * The shipping-rate step lives in checkout-shipping.spec.ts (@shipping) at a
 * lower cadence — it has to enter an email, which creates an abandoned
 * checkout record on every run.
 * Runs on desktop-chromium AND mobile-safari (@cart tag).
 */

test('@cart PDP → cart → checkout with regression tripwires', async ({ page }) => {
  await openFirstAvailableProduct(page)
  await addToCartAndOpenDrawer(page)

  // --- 1. Line item actually visible (the empty-cart bug class) -------------
  // /cart renders line items as table rows; the drawer's container div also
  // matches [class*="line-item"] while hidden, so require a visible, priced row.
  const lineItems = page
    .locator('table tbody tr, .line-item, line-item, [class*="line-item"]')
    .filter({ hasText: /\$\s?\d/ })
    .filter({ visible: true })
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
      .locator('table tbody tr, .line-item, line-item')
      .filter({ hasText: /\$\s?\d/ })
      .filter({ hasNotText: /adult signature|special card|greeting card/i })
      .filter({ visible: true })
      .first()
      .locator('a[href*="quantity=0"], a[aria-label*="emove" i], button[aria-label*="emove" i], a:has-text("Remove")')
      .first()
    // The Remove link is visually hidden on desktop (quantity spinner is the
    // visible control), so follow its href instead of clicking it.
    await expect(parentRemove, 'remove control on parent line item').toHaveCount(1)
    const removeHref = await parentRemove.getAttribute('href')
    if (removeHref) await page.goto(removeHref, { waitUntil: 'domcontentloaded' })
    else await parentRemove.click()
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
  await expect(page.locator('body')).toContainText(/contact|delivery|shipping|express/i, {
    timeout: 20_000,
  })
})
