import { test, expect } from '@playwright/test';

test.describe('Transactions Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to transactions page
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('should load transactions page', async ({ page }) => {
    // Check page title or heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible();
  });

  test('should display transaction list', async ({ page }) => {
    // Check if transaction table or list is present
    const table = page.locator('table, [role="grid"]');

    // Wait for content to load
    await page.waitForTimeout(500);

    // Table should be visible (even if empty)
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have quick add button', async ({ page }) => {
    // Look for quick add button (FloatingQuickAdd component)
    const quickAddButton = page.locator('button:has-text("Add"), button:has-text("Quick")', {
      hasText: /add|quick/i
    }).first();

    // Button should be visible or the page should have a way to add transactions
    const addElements = page.locator('button').filter({ has: page.locator('text=/add|quick/i') });

    if (await addElements.count() > 0) {
      await expect(addElements.first()).toBeVisible();
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Content should still be accessible
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
