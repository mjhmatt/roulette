import { test, expect } from '@playwright/test';

// 10 Diverse YouTube Roulette Sources for Validation
const SOURCES = [
    { name: 'Source 1: Standard Top-Down', url: 'https://www.youtube.com/watch?v=C8QLePvWYdo' },
    { name: 'Source 2: Live Dealer Zoom', url: 'https://www.youtube.com/watch?v=6Id9Im9_7yo' },
    { name: 'Source 3: Perspective Angle', url: 'https://www.youtube.com/watch?v=XunkaAmZ6Gs' },
    { name: 'Source 4: High Quality Live', url: 'https://www.youtube.com/watch?v=NH_6To9_shA' },
    { name: 'Source 5: Deep Perspective', url: 'https://www.youtube.com/watch?v=bpy933SQ6Q0' },
    { name: 'Source 6: Electronic Wheel', url: 'https://www.youtube.com/watch?v=q6g6Dk8m7XU' },
    { name: 'Source 7: Casino Stream 1', url: 'https://www.youtube.com/watch?v=O1HQuv8_GTM' },
    { name: 'Source 8: Casino Stream 2', url: 'https://www.youtube.com/watch?v=R46-T_t4p7k' },
    { name: 'Source 9: Automated Wheel', url: 'https://www.youtube.com/watch?v=Y0n9_PzF_Y0' },
    { name: 'Source 10: Alternative View', url: 'https://www.youtube.com/watch?v=vV9X9eS2Z6c' }
];

test.describe('Universal 10-Source Validation', () => {
    // Increase timeout for the whole suite
    test.setTimeout(600000); // 10 minutes

    test.beforeEach(async ({ page }) => {
        try {
            const response = await page.request.get('http://localhost:8000/api/windows');
            expect(response.ok()).toBeTruthy();
        } catch (e) {
            console.error("Backend not running on port 8000. Start it with 'python backend/main.py'");
            throw e;
        }
    });

    for (const source of SOURCES) {
        test(`Validation for ${source.name}`, async ({ page, context }) => {
            console.log(`\n>>> STARTING VALIDATION: ${source.name} (${source.url})`);

            // 1. Open the YouTube source
            const youtubePage = await context.newPage();
            await youtubePage.goto(source.url);

            // Try to handle YouTube overlays/play buttons
            try {
                await youtubePage.click('button.ytp-large-play-button', { timeout: 10000 });
                // Mute for convenience
                await youtubePage.keyboard.press('m');
            } catch (e) {}

            // 2. Open our HUD
            await page.goto('http://localhost:5173');
            await page.waitForSelector('#windowSelector', { timeout: 30000 });

            // 3. Select the YouTube tab
            console.log('Detecting YouTube tab...');
            await page.waitForTimeout(3000); // Wait for window list to refresh

            const windowItem = page.locator('.window-item', { hasText: 'YouTube' }).first();
            try {
                await expect(windowItem).toBeVisible({ timeout: 20000 });
                await windowItem.click();
            } catch (e) {
                console.log('YouTube tab not explicitly found, selecting first available window...');
                await page.locator('.window-item').first().click();
            }

            // 4. Wait for Universal Calibration (Board Detected)
            console.log('Waiting for Universal Calibration...');
            await page.waitForFunction(() => (window as any).cvCalibrated === true, { timeout: 45000 });
            console.log('✅ UNIVERSAL CALIBRATION LOCKED');

            // 5. Wait for Live Prediction
            // We require a non-idle RPM and a valid prediction index (0-37)
            console.log('Waiting for Live Prediction & Motion Analysis...');
            await page.waitForFunction(() => {
                const rpmW = (window as any).cvWheelRPM || 0;
                const rpmB = (window as any).cvBallRPM || 0;
                const pred = (window as any).currentPrediction; // assuming this is exposed
                // Prediction >= 0 means we found a pocket
                return (rpmW > 0.1 || rpmB > 0.1) && pred !== undefined && pred !== -1;
            }, { timeout: 120000 });

            const wheelRPM = await page.evaluate(() => (window as any).cvWheelRPM);
            const ballRPM = await page.evaluate(() => (window as any).cvBallRPM);
            const prediction = await page.evaluate(() => (window as any).currentPrediction);

            console.log(`✅ SUCCESS: Prediction Made: ${prediction}`);
            console.log(`📈 Metrics: Wheel RPM: ${wheelRPM.toFixed(2)} | Ball RPM: ${ballRPM.toFixed(2)}`);

            // 6. Final Capture
            await page.screenshot({ path: `test-results/pass-${source.name.replace(/[:\s]+/g, '-')}.png` });

            expect(prediction).not.toBe(-1);
            expect(wheelRPM + ballRPM).toBeGreaterThan(0.1);
        });
    }
});
