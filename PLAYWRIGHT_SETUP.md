# Playwright E2E Testing Setup

Playwright telah berhasil diintegrasikan ke dalam project katalis-ventura.

## 📦 Instalasi

Playwright sudah terinstall sebagai dev dependency. Untuk menginstall browser drivers:

```bash
npx playwright install
```

## 🚀 Cara Menjalankan Tests

### Run semua tests
```bash
npm run test:e2e
```

### Run tests dengan UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Debug tests
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/e2e/dashboard.spec.ts
```

### Run tests dengan headed mode (visible browser)
```bash
npx playwright test --headed
```

## 📁 Struktur Tests

```
tests/
└── e2e/
    ├── dashboard.spec.ts      # Dashboard page tests
    └── transactions.spec.ts    # Transactions page tests
```

## ⚙️ Konfigurasi

File konfigurasi: `playwright.config.ts`

**Key settings:**
- Base URL: `http://localhost:3000`
- Test directory: `tests/e2e`
- Browsers: Chromium, Firefox, WebKit
- Auto-start dev server: ✓ (jika tidak ada yang berjalan)
- Screenshots: Hanya saat test gagal
- Videos: Hanya saat test gagal

## 📝 Membuat Test Baru

1. Buat file baru di `tests/e2e/` dengan format: `*.spec.ts`

2. Template dasar:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/path');
  });

  test('should do something', async ({ page }) => {
    // Test logic
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

## 🔍 Useful Locator Strategies

```typescript
// By text
page.locator('text=Login')

// By role
page.locator('button[role="button"]')

// By placeholder
page.locator('input[placeholder="Email"]')

// By test ID (recommended)
page.locator('[data-testid="submit-btn"]')

// Complex selectors
page.locator('div:has-text("Active") >> button')
```

## 📊 Viewing Test Results

After running tests, an HTML report is generated:

```bash
npx playwright show-report
```

## 🐛 Troubleshooting

### Tests timeout
- Increase timeout in config atau per test:
```typescript
test('slow test', async ({ page }) => {
  // ...
}, { timeout: 30000 }); // 30 seconds
```

### Dev server not starting
- Make sure port 3000 is available
- Or update `baseURL` dalam `playwright.config.ts`

### Tests pass locally but fail in CI
- Set environment variable: `CI=true`
- Tests akan run dengan retries dan single worker

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Locator API](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)

## 🎯 Next Steps

1. Install browser drivers: `npx playwright install`
2. Start dev server: `npm run dev`
3. Run tests: `npm run test:e2e`
4. Add more tests sesuai kebutuhan aplikasi
