import { test, expect } from '@playwright/test';

// Diverse YouTube Roulette Sources for Validation
const SOURCES = [
    { name: 'Live Stream 1', url: 'https://www.youtube.com/watch?v=C8QLePvWYdo' }, // Original
    { name: 'Live Stream 2', url: 'https://www.youtube.com/watch?v=6Id9Im9_7yo' }, // Live dealer
    { name: 'Live Stream 3', url: 'https://www.youtube.com/watch?v=XunkaAmZ6Gs' }, // Alternative angle
    { name: 'Live Stream 4', url: 'https://www.youtube.com/watch?v=NH_6To9_shA' }  // Perspective view
];

test.describe('Universal Wheel Detection Validation', () => {
    test.beforeEach(async ({ page }) => {
        // Ensure backend is reachable
        try {
            const response = await page.request.get('http://localhost:8000/windows');
            expect(response.ok()).toBeTruthy();
        } catch (e) {
            console.error("Backend not running on port 8000. Start it with 'python backend/main.py'");
            throw e;
        }
    });

    for (const source of SOURCES) {
        test(`should detect wheel and measure RPM from ${source.name}`, async ({ page, context }) => {
            console.log(`\n--- Testing Source: ${source.name} (${source.url}) ---`);

            // 1. Open the YouTube source in a new tab
            const youtubePage = await context.newPage();
            await youtubePage.goto(source.url);

            // Try to click play if it's not autoplaying (common on YouTube)
            try {
                await youtubePage.click('button.ytp-large-play-button', { timeout: 5000 });
            } catch (e) {
                // Already playing or button not found
            }

            // 2. Open our HUD
            await page.goto('http://localhost:8000');
            await page.waitForSelector('#window-list');

            // 3. Select the YouTube tab in our HUD
            // We look for "YouTube" or the video title in the window list
            const windowItem = page.locator('.window-item', { hasText: 'YouTube' }).first();
            await expect(windowItem).toBeVisible({ timeout: 10000 });
            await windowItem.click();

            console.log('Window selected. Waiting for Calibration...');

            // 4. Wait for CV to Calibrate (Board Detected)
            // We check the 'cvCalibrated' flag on the window object
            await page.waitForFunction(() => (window as any).cvCalibrated === true, { timeout: 30000 });
            console.log('✅ WHEEL DETECTED');

            // 5. Wait for Spin Detection & RPMs
            console.log('Waiting for Motion & RPM Measurements...');
            await page.waitForFunction(() => {
                const rpm = (window as any).cvWheelRPM || 0;
                return rpm > 0.1;
            }, { timeout: 60000 });

            const wheelRPM = await page.evaluate(() => (window as any).cvWheelRPM);
            console.log(`✅ MOTION DETECTED: Wheel RPM = ${wheelRPM.toFixed(2)}`);

            // 6. Final verification - Take a screenshot for audit
            await page.screenshot({ path: `test-results/detection-${source.name.replace(/\s+/g, '-')}.png` });

            expect(wheelRPM).toBeGreaterThan(0);
        });
    }
});
