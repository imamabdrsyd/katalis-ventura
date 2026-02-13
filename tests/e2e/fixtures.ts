import { test as base, Page } from '@playwright/test';

/**
 * Custom fixtures untuk testing
 * Extend base test dengan helper functions
 */
type CustomFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<CustomFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Jika aplikasi memerlukan authentication, tambahkan logic di sini
    // Contoh:
    // await page.goto('/login');
    // await page.fill('input[name="email"]', 'test@example.com');
    // await page.fill('input[name="password"]', 'password');
    // await page.click('button[type="submit"]');

    // Untuk sekarang, langsung navigate ke home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await use(page);
  },
});

export { expect } from '@playwright/test';
