import { test, expect } from '@playwright/test';

/**
 * Contoh test untuk form input
 * Sesuaikan selectors dan actions sesuai dengan aplikasi Anda
 */

test.describe('Form Input Examples', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate ke halaman yang memiliki form
    // Ubah URL sesuai dengan aplikasi Anda
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('example: fill text input', async ({ page }) => {
    // Mencari input dengan selector tertentu
    const input = page.locator('input[type="text"]').first();

    if (await input.isVisible()) {
      await input.fill('Sample Text');
      await expect(input).toHaveValue('Sample Text');
    }
  });

  test('example: click button and wait for navigation', async ({ page }) => {
    // Cari button dengan text tertentu
    const button = page.locator('button:has-text("Add")').first();

    // Wait untuk navigation jika button trigger page change
    if (await button.isVisible()) {
      await button.click();
      // Optional: wait for navigation
      // await page.waitForNavigation();
    }
  });

  test('example: select dropdown option', async ({ page }) => {
    const select = page.locator('select').first();

    if (await select.isVisible()) {
      await select.selectOption('option1'); // by value
      // atau: await select.selectOption({ label: 'Option 1' }); // by label
    }
  });

  test('example: fill form and submit', async ({ page }) => {
    // Temukan form
    const form = page.locator('form').first();

    if (await form.isVisible()) {
      // Fill input fields
      const inputs = form.locator('input[type="text"]');
      const count = await inputs.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 2); i++) {
          await inputs.nth(i).fill(`Test Value ${i + 1}`);
        }

        // Find dan click submit button
        const submitBtn = form.locator('button[type="submit"]').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
        }
      }
    }
  });

  test('example: check visibility and accessibility', async ({ page }) => {
    // Check if element visible
    const element = page.locator('h1, h2').first();
    await expect(element).toBeVisible();

    // Get text content
    const text = await element.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);

    // Check if element is enabled
    const button = page.locator('button').first();
    if (await button.isVisible()) {
      await expect(button).toBeEnabled();
    }
  });
});
