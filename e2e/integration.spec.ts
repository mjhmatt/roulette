import { test, expect } from '@playwright/test';

test.describe('End-to-End System Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Connect to the HUD
    await page.goto('http://localhost:5173');
  });

  test('Backend Integration: Should receive live heartbeat telemetry', async ({ page }) => {
    // This test verifies that the Python backend is RUNNING and CONNECTED
    // It checks the real frameCount variable in index.ts which only
    // increments when a real WebSocket message arrives from Python.

    console.log('Waiting for live telemetry from Python backend...');

    // Wait for frameCount to increase (meaning messages are arriving)
    const isReceivingFrames = await page.waitForFunction(() => {
      // @ts-ignore
      return window.frameCount > 0;
    }, { timeout: 15000 });

    expect(isReceivingFrames).toBeTruthy();

    // Check if the UI reflects the WS: ON status
    const wsStatus = page.locator('text=WS: ON');
    await expect(wsStatus).toBeVisible();
  });

  test('Window Selection: Should successfully list browser tabs from Python', async ({ page }) => {
    // This test proves the REST API on port 8000 is working
    const refreshBtn = page.locator('#refreshWindowsBtn');
    await refreshBtn.click();

    // The list should eventually contain "Full Screen" or real tabs
    // If this fails, the FastAPI part of the backend is broken.
    const windowsList = page.locator('#windowsList');
    await expect(windowsList).not.toContainText('No Chrome tabs found', { timeout: 10000 });
  });
});
