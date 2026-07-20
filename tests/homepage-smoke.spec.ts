import { test, expect } from '@playwright/test'

/** @smoke — cheap availability + render check (replaces the auto-named UI check) */
test('@smoke homepage renders nav, hero, and cart affordance', async ({ page }) => {
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(res?.status(), 'homepage returns 2xx').toBeLessThan(400)
  await expect(page.locator('header, [class*="header"]').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /build your own basket/i }).first()).toBeVisible()
  await expect(page.locator('a[href="/cart"], [aria-label*="cart" i]').first()).toBeVisible()
})
