import { test, expect, Page } from '@playwright/test'
import { openFirstAvailableProduct, addToCartAndOpenDrawer } from '../helpers/journey'

/**
 * BroBasket checkout shipping step — the stage the cart journey stops short of.
 *
 * Background (Sep 2026): completed checkouts fell ~39% from Sep 5 with sessions
 * and add-to-cart flat, and 32 of 33 abandoned checkouts had a shipping address
 * filled in — customers were leaving at the shipping/payment step, which no
 * synthetic covered. UPS-calculated rates (+45% handling) are quoted per
 * address, so a rate failure or a fee doubling is invisible until an address
 * goes in.
 *
 * Pass condition: for each test state, at least one priced shipping method
 * renders, no "can't ship" message appears, and Adult Signature appears at
 * most once. Never completes a purchase, never touches payment.
 *
 * COST: entering an email creates an abandoned-checkout record on every run,
 * so this check runs every 6h (not hourly) and always uses MONITOR_EMAIL.
 * Suppress that address in Klaviyo and exclude it from abandoned-checkout
 * reporting.
 */

export const MONITOR_EMAIL = 'checkly-monitor@gotogifting.com'

/** Synthetic addresses — real ZIP/city pairs so UPS-calculated rates can quote. */
const TEST_ADDRESSES = [
  { state: 'PA', zone: 'Pennsylvania', city: 'Philadelphia', address1: '1400 John F Kennedy Blvd', zip: '19107' },
  { state: 'NY', zone: 'New York',     city: 'New York',     address1: '350 5th Ave',              zip: '10118' },
]

/** Fill (or re-fill) the Shopify checkout address form and wait for rates. */
async function fillCheckoutAddress(page: Page, a: (typeof TEST_ADDRESSES)[number]) {
  const email = page.locator('input[type="email"], #email').first()
  if (await email.isVisible().catch(() => false)) await email.fill(MONITOR_EMAIL)

  const fill = async (name: string, value: string) => {
    const el = page.locator(`input[name="${name}"], input[autocomplete="${name}"]`).first()
    if (await el.isVisible().catch(() => false)) await el.fill(value)
  }
  await fill('firstName', 'Checkly')
  await fill('lastName', 'Monitor')
  await fill('address1', a.address1)
  await fill('city', a.city)
  await fill('postalCode', a.zip)
  await fill('phone', '8055550100')

  const zone = page.locator('select[name="zone"], select[name="province"]').first()
  if (await zone.isVisible().catch(() => false)) {
    await zone.selectOption({ label: a.zone }).catch(() => zone.selectOption(a.state))
  }
  // Blur the last field so checkout re-quotes rates for the new address.
  await page.keyboard.press('Tab')
}

/** Assert the shipping-method step rendered a priced option for the current address. */
async function expectPricedShippingRate(page: Page, label: string) {
  const cantShip = page.getByText(
    /no shipping methods|not available for your address|don't ship|do not ship|can't ship|cannot ship|shipping isn't available/i,
  )
  const shippingSection = page
    .locator('section, fieldset, div')
    .filter({ hasText: /shipping method/i })
    .last()
  // Rates are quoted asynchronously (UPS-calculated) — give them time.
  await expect
    .poll(
      async () => {
        if (await cantShip.count()) return 'cant-ship'
        const txt = (await shippingSection.textContent().catch(() => '')) || ''
        return /\$\s?\d+(\.\d{2})?/.test(txt) || /free/i.test(txt) ? 'priced' : 'pending'
      },
      { message: `${label}: shipping method step resolved`, timeout: 45_000 },
    )
    .toBe('priced')

  const rateText = ((await shippingSection.textContent()) || '').replace(/\s+/g, ' ').trim()
  console.log(`[${label}] shipping methods: ${rateText.slice(0, 300)}`)

  // Adult Signature must appear exactly once in the order summary
  // (double-fee carts were seen in abandoned checkouts, Sep 2026).
  const sigCount = await page.getByText(/adult signature/i).count()
  expect(sigCount, `${label}: adult signature line appears at most once (saw ${sigCount})`).toBeLessThanOrEqual(1)
}

test('@shipping checkout address → priced shipping rate (PA, NY)', async ({ page }) => {
  await openFirstAvailableProduct(page)
  await addToCartAndOpenDrawer(page)

  const checkoutBtn = page
    .locator('button[name="checkout"], a[href*="/checkout"], [data-testid*="checkout"]')
    .first()
  await expect(checkoutBtn, 'checkout CTA visible').toBeVisible()
  await checkoutBtn.click()
  await page.waitForURL(/checkout|\/checkouts\//, { timeout: 30_000 })
  await expect(page.locator('body')).toContainText(/contact|delivery|shipping|express/i, {
    timeout: 20_000,
  })

  for (const a of TEST_ADDRESSES) {
    await test.step(`shipping rates for ${a.state}`, async () => {
      await fillCheckoutAddress(page, a)
      await expectPricedShippingRate(page, a.state)
    })
  }
})
