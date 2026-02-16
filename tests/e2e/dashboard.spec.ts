import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');
  });

  test('should load dashboard page', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check if page has expected elements
    await expect(page).toHaveTitle(/.*/, { timeout: 10000 });
  });

  test('should display main navigation', async ({ page }) => {
    // Check if navigation is visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should have responsive layout', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Check if page is still usable
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
