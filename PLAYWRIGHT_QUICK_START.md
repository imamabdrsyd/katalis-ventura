# Playwright Quick Start

## ✅ Setup Selesai!

Playwright sudah siap digunakan di project katalis-ventura.

### 📋 Yang sudah diinstall:

- ✅ `@playwright/test` (v1.58.2)
- ✅ Browser drivers: Chromium, Firefox, WebKit
- ✅ Configuration file: `playwright.config.ts`
- ✅ Sample test files di `tests/e2e/`

### 🚀 Mulai Testing (3 Langkah)

**1. Terminal 1 - Jalankan dev server:**
```bash
npm run dev
```

**2. Terminal 2 - Jalankan tests:**
```bash
npm run test:e2e        # Run all tests
npm run test:e2e:ui     # Interactive UI mode (recommended for learning)
npm run test:e2e:debug  # Debug mode dengan step-by-step
```

### 📝 Test Files yang Sudah Ada

```
tests/e2e/
├── dashboard.spec.ts          # Basic dashboard tests
├── transactions.spec.ts       # Transaction page tests
├── example-form-input.spec.ts # Form input examples
└── fixtures.ts                # Custom fixtures & helpers
```

### 💡 Contoh Membuat Test Baru

**File: `tests/e2e/my-feature.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/path-to-feature');
    
    // Interact with page
    await page.locator('button').first().click();
    
    // Assert
    await expect(page.locator('h1')).toContainText('Expected Text');
  });
});
```

### 📚 Dokumentasi Lengkap

Lihat: **`PLAYWRIGHT_SETUP.md`** untuk dokumentasi mendetail

### 🆘 Troubleshooting

**Tests gagal timeout?**
```typescript
test('slow test', async ({ page }) => {
  // ...
}, { timeout: 60000 }); // 60 seconds
```

**Dev server tidak auto-start?**
```bash
# Pastikan port 3000 available
lsof -i :3000  # Check what's using port 3000
```

**Video/Screenshot tidak tersimpan?**
Automatically disimpan hanya saat test gagal di `test-results/`

---

### 🎯 Next Steps

1. Baca `PLAYWRIGHT_SETUP.md` untuk dokumentasi lengkap
2. Jalankan `npm run test:e2e:ui` untuk explore tests secara interaktif
3. Tambahkan test cases sesuai fitur aplikasi
4. Integrate dengan CI/CD (GitHub Actions, etc.)

Happy Testing! 🎭
