import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'https://thebrobasket.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Desktop Chromium — parity with the legacy UI-authored checks
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    // WebKit / iPhone — the blind spot. Both 2026 third-party incidents
    // (EBB May, Accessibly July) were WebKit-only and invisible to Chromium checks.
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
})
