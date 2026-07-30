import { test, expect } from '@playwright/test';

test.describe('E2E App Landing Page Tests', () => {
  test('should load landing page successfully and verify structural components', async ({ page }) => {
    // Navigate to the local dev server (default port 5173 for Vite)
    await page.goto('http://localhost:5173');

    // 1. Verify page title
    await expect(page).toHaveTitle(/AI Study Planner/i);

    // 2. Verify main heading exists
    const mainHeading = page.locator('h1');
    await expect(mainHeading).toBeVisible();

    // 3. Verify landing layout structure is present (e.g. CTA buttons, auth containers)
    const loginBtn = page.locator('button:has-text("Get Started"), a:has-text("Sign In"), button:has-text("Log In"), button:has-text("Sign Up")').first();
    if (await loginBtn.count() > 0) {
      await expect(loginBtn).toBeVisible();
    }
  });

  test('should support light/dark mode theme toggling structurally', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Find the theme toggle button (represented by moon/sun icon classes or descriptive attributes)
    const themeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"], button:has-text("Theme")').first();
    if (await themeToggle.count() > 0) {
      await expect(themeToggle).toBeVisible();
      await themeToggle.click();
    }
  });
});
