import { test, expect } from '@playwright/test';

test.describe('End-to-End Vision Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('Live Detection: Should find the wheel when a tab is selected', async ({ page }) => {
    // 1. Select the first available Chrome tab
    const refreshBtn = page.locator('#refreshWindowsBtn');
    await refreshBtn.click();

    const firstTab = page.locator('.window-item').first();
    await expect(firstTab).toBeVisible({ timeout: 10000 });
    await firstTab.click();

    console.log('Tab selected. Waiting for Computer Vision to find the wheel...');

    // 2. Wait for the green notification or calibrated status
    // This test now supports the "Motion Centroid" fallback added to the backend
    const isCalibrated = await page.waitForFunction(() => {
      // @ts-ignore
      return window.cvCalibrated === true;
    }, { timeout: 30000 });

    expect(isCalibrated).toBeTruthy();
    
    // 3. Check for the green "Board Detected" footer
    const footer = page.locator('#statusFooter');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Board Detected');
  });
});
