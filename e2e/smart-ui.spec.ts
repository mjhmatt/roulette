import { test, expect } from '@playwright/test';

test.describe('End-to-End Smart Vision Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('Smart UI: Should show "SEARCHING FOR WHEEL" when no window selected', async ({ page }) => {
    // Backend integration test verified heartbeat is frameCount > 0
    await page.waitForFunction(() => (window as any).frameCount > 0, { timeout: 10000 });

    const info = page.locator('#info');
    await expect(info).toContainText('SEARCHING FOR WHEEL...');
  });

  test('Smart UI: Should show "CALIBRATED & SCANNING" after calibration', async ({ page }) => {
    // 1. Disable real backend updates
    await page.evaluate(() => {
      if ((window as any).cvSocket) {
        (window as any).cvSocket.off('prediction_update');
      }
    });

    // 2. Set the global state and simulate update
    await page.evaluate(() => {
      (window as any).cvCalibrated = true;
      (window as any).simulateCVUpdate({
        wheel_rpm: 0,
        ball_rpm: 0,
        prediction: -1,
        is_spinning: false,
        calibrated: true
      });
    });

    // 3. Verify UI change
    const info = page.locator('#info');
    await expect(info).toContainText('CALIBRATED & SCANNING', { timeout: 10000 });
  });

  test('Smart UI: Should show "🔮 Prediction" during a spin', async ({ page }) => {
    // 1. Disable real backend updates
    await page.evaluate(() => {
      if ((window as any).cvSocket) {
        (window as any).cvSocket.off('prediction_update');
      }
    });

    // 2. Simulate active spin
    await page.evaluate(() => {
      (window as any).cvCalibrated = true;
      (window as any).simulateCVUpdate({
        wheel_rpm: 30,
        ball_rpm: 100,
        prediction: 17,
        is_spinning: true,
        calibrated: true
      });
    });

    const predictionHeader = page.locator('text=🔮 Prediction');
    await expect(predictionHeader).toBeVisible();
    await expect(page.locator('#predictionDisplay')).toContainText('17');
  });
});
