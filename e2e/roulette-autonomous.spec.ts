import { test, expect } from '@playwright/test';

test.describe('Autonomous Predictor E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    // Wait for the system to initialize
    await page.waitForFunction(() => {
      const info = document.getElementById('info');
      return info && info.innerText.includes('MOTION');
    }, { timeout: 10000 });
  });

  test('should update UI correctly from simulated video data', async ({ page }) => {
    // 1. Mute the real backend to prevent interference during test
    await page.evaluate(() => {
      if ((window as any).cvSocket) {
        (window as any).cvSocket.off('prediction_update');
      }
    });

    // 2. Inject controlled test data (Region: 17, RPMs: 30.5, 120.2)
    await page.evaluate(() => {
      (window as any).simulateCVUpdate({
        prediction: 17,
        wheel_rpm: 30.5,
        ball_rpm: 120.2,
        is_spinning: true
      });
    });

    // 3. Verify Autonomous Prediction Display
    const predictionText = page.locator('#predictionDisplay');
    await expect(predictionText).toContainText('17');

    // 4. Verify Telemetry Display
    const infoText = page.locator('#info');
    await expect(infoText).toContainText('30.5');
    await expect(infoText).toContainText('120.2');
  });

  test('should visually translate pocket 37 to "00"', async ({ page }) => {
    await page.evaluate(() => {
      if ((window as any).cvSocket) {
        (window as any).cvSocket.off('prediction_update');
      }
      (window as any).simulateCVUpdate({
        prediction: 37,
        wheel_rpm: 20.0,
        ball_rpm: 100.0,
        is_spinning: true
      });
    });

    const predictionText = page.locator('#predictionDisplay');
    await expect(predictionText).toContainText('00');
  });
});
