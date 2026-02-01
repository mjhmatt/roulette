import { test, expect } from '@playwright/test';

test.describe('HUD Telemetry & History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Wait for HUD to load
    await expect(page.locator('#info')).toBeVisible();
  });

  test('should show correct status when receiving data', async ({ page }) => {
    // Disable real backend updates
    await page.evaluate(() => {
      if ((window as any).cvSocket) (window as any).cvSocket.off('prediction_update');
    });

    // Inject simulated update
    await page.evaluate(() => {
      (window as any).cvCalibrated = false;
      (window as any).simulateCVUpdate({
        wheel_rpm: 0,
        ball_rpm: 0,
        prediction: -1,
        is_spinning: false,
        calibrated: false
      });
    });

    const statusText = page.locator('#telemetryPanel');
    await expect(statusText).toContainText('SEARCHING FOR WHEEL...', { timeout: 10000 });
  });

  test('should show MOTION status when RPMs are detected', async ({ page }) => {
    // Disable real backend updates
    await page.evaluate(() => {
      if ((window as any).cvSocket) (window as any).cvSocket.off('prediction_update');
    });

    await page.evaluate(() => {
      (window as any).cvCalibrated = true;
      (window as any).simulateCVUpdate({
        wheel_rpm: 25.5,
        ball_rpm: 10.2,
        prediction: 12,
        is_spinning: true,
        calibrated: true
      });
    });

    const statusText = page.locator('#telemetryPanel');
    await expect(statusText).toContainText('DETECTING MOTION', { timeout: 10000 });
    await expect(page.locator('#predictionDisplay')).toContainText('12');
  });

  test('should update spin history when a spin finishes', async ({ page }) => {
    // Disable real backend updates
    await page.evaluate(() => {
      if ((window as any).cvSocket) (window as any).cvSocket.off('prediction_update');
    });

    // 1. Start spin
    await page.evaluate(() => {
      (window as any).simulateCVUpdate({
        wheel_rpm: 20,
        ball_rpm: 50,
        prediction: 7,
        is_spinning: true
      });
    });

    // 2. Stop spin (simulate CV logic where it saves result on stop)
    await page.evaluate(() => {
      (window as any).simulateCVUpdate({
        wheel_rpm: 0,
        ball_rpm: 0,
        prediction: -1,
        is_spinning: false
      });
    });

    // 3. Check history list (0-10 items displayed)
    const historyItem = page.locator('div[title]').first();
    await expect(historyItem).toBeVisible();
    await expect(historyItem).toContainText('7');
  });

  test('should display "00" for pocket 37', async ({ page }) => {
    // Disable real backend updates
    await page.evaluate(() => {
      if ((window as any).cvSocket) (window as any).cvSocket.off('prediction_update');
    });

    await page.evaluate(() => {
      (window as any).simulateCVUpdate({
        wheel_rpm: 10,
        ball_rpm: 20,
        prediction: 37,
        is_spinning: true
      });
    });

    await expect(page.locator('#predictionDisplay')).toContainText('00');

    // Finish spin and check history
    await page.evaluate(() => {
      (window as any).simulateCVUpdate({
        wheel_rpm: 0,
        ball_rpm: 0,
        prediction: -1,
        is_spinning: false
      });
    });

    const historyItem = page.locator('div[title]').first();
    await expect(historyItem).toContainText('00');
  });

  test('should show board detection notification', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).triggerBoardDetected({
        center: { x: 500, y: 500 },
        radius: 300,
        window: 'Test Tab'
      });
    });

    const notification = page.locator('#boardNotification');
    await expect(notification).toBeVisible();
    await expect(notification).toContainText('ROULETTE BOARD DETECTED!');
    await expect(notification).toContainText('Test Tab');
  });
});
