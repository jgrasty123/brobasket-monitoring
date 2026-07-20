import { test, expect, Page } from '@playwright/test'
import { isKnownNoise } from '../helpers/known-noise'

/**
 * Console error sentinel — active complement to Sentry.
 * Fails when any UNKNOWN uncaught exception or console.error fires on the
 * top-of-funnel pages. This is the check that would have flagged the
 * Accessibly WebKit break (Jul 18) within one schedule interval instead of
 * waiting for real-user Sentry volume to accumulate.
 * Runs on desktop-chromium AND mobile-safari (@sentinel tag).
 */

const PAGES = ['/', '/collections/gift-baskets-for-men']

function collectErrors(page: Page, sink: string[]) {
  page.on('pageerror', (err) => {
    if (!isKnownNoise(String(err?.message ?? err))) sink.push(`pageerror: ${err.message}`)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isKnownNoise(msg.text()))
      sink.push(`console.error: ${msg.text()}`)
  })
}

for (const path of PAGES) {
  test(`@sentinel no unknown JS errors on ${path}`, async ({ page }) => {
    const errors: string[] = []
    collectErrors(page, errors)
    await page.goto(path, { waitUntil: 'load' })
    // Let deferred loaders (Clarity, Help Scout, app embeds) fire
    await page.waitForTimeout(10_000)
    // Light interaction to trigger interaction-deferred scripts
    await page.mouse.move(200, 300)
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(5_000)
    expect(errors, `unexpected JS errors on ${path}:\n${errors.join('\n')}`).toHaveLength(0)
  })
}

test('@sentinel no unknown JS errors on first PDP', async ({ page }) => {
  const errors: string[] = []
  collectErrors(page, errors)
  await page.goto('/collections/gift-baskets-for-men', { waitUntil: 'domcontentloaded' })
  await page.locator('a[href*="/products/"]').first().click()
  await page.waitForURL(/\/products\//)
  await page.waitForTimeout(10_000)
  expect(errors, `unexpected JS errors on PDP:\n${errors.join('\n')}`).toHaveLength(0)
})
