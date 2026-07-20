import { defineConfig } from 'checkly'
import { Frequency, RetryStrategyBuilder } from 'checkly/constructs'

/**
 * BroBasket Monitoring as Code
 * Deploy: `npx checkly deploy` (needs CHECKLY_API_KEY + CHECKLY_ACCOUNT_ID env vars)
 *
 * Slices (by Playwright tag):
 *  @cart      — full PDP→cart→checkout journey incl. regression assertions
 *               (orphan adult-signature fee, date picker resolves)
 *  @sentinel  — console error sentinel on homepage/collection/PDP
 *  @smoke     — cheap homepage smoke
 * Each slice runs on desktop-chromium AND mobile-safari (WebKit).
 */
export default defineConfig({
  projectName: 'BroBasket Monitoring',
  logicalId: 'brobasket-monitoring',
  repoUrl: 'https://github.com/jgrasty123/brobasket-monitoring',
  checks: {
    activated: true,
    muted: false,
    runtimeId: '2025.04',
    locations: ['us-west-1', 'us-east-1'],
    tags: ['brobasket', 'mac'],
    // Retry once from another region before alerting — kills single-blip false positives
    retryStrategy: RetryStrategyBuilder.fixedStrategy({
      baseBackoffSeconds: 30,
      maxRetries: 1,
      sameRegion: false,
    }),
    // Browser/Playwright checks require a paid plan (Hobby includes 0).
    // Set CHECKLY_ENABLE_BROWSER_SUITE=1 and redeploy after upgrading.
    ...(process.env.CHECKLY_ENABLE_BROWSER_SUITE === '1'
      ? { playwrightConfigPath: './playwright.config.ts' }
      : {}),
    playwrightChecks: process.env.CHECKLY_ENABLE_BROWSER_SUITE !== '1' ? [] : [
      {
        logicalId: 'cart-journey',
        name: 'BroBasket — Cart Journey (Chromium + WebKit)',
        pwTags: ['@cart'],
        frequency: Frequency.EVERY_10M,
      },
      {
        logicalId: 'console-sentinel',
        name: 'BroBasket — Console Error Sentinel (Chromium + WebKit)',
        pwTags: ['@sentinel'],
        frequency: Frequency.EVERY_30M,
      },
      {
        logicalId: 'homepage-smoke',
        name: 'BroBasket — Homepage Smoke',
        pwTags: ['@smoke'],
        frequency: Frequency.EVERY_1H,
      },
    ],
  },
  cli: { runLocation: 'us-west-1' },
})
