# BroBasket Monitoring (as code)

Checkly synthetic monitoring for thebrobasket.com. Checks are Playwright tests
deployed via the Checkly CLI — never edit checks in the Checkly UI; change the
code here and deploy.

## Slices
| Tag | Check | Frequency | Browsers |
|---|---|---|---|
| `@cart` | Full PDP→cart→checkout journey + regression tripwires (orphan adult-signature fee, date picker resolves) | 10 min | Chromium + WebKit/iPhone |
| `@sentinel` | Console error sentinel with known-noise allowlist (`helpers/known-noise.ts`) | 30 min | Chromium + WebKit/iPhone |
| `@smoke` | Homepage render smoke | 60 min | Chromium + WebKit/iPhone |

WebKit coverage exists because both 2026 third-party incidents (EBB in May,
Accessibly in July) were WebKit-only and invisible to Chromium-based checks.

## Deploy
```
export CHECKLY_API_KEY=... CHECKLY_ACCOUNT_ID=...
npm install
npx checkly test        # dry-run all checks once from us-west-1
npx checkly deploy
```
Keep `helpers/known-noise.ts` in sync with Sentry inbound filters.
