import { test, expect } from '@playwright/test';

test.describe('Window Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Start backend server if not running
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should display window selector UI', async ({ page }) => {
    // Check that window selector section exists
    const selector = page.locator('#windowSelector');
    await expect(selector).toBeVisible();

    // Check for the title
    await expect(selector.locator('text=SELECT CHROME TAB TO MONITOR')).toBeVisible();
  });

  test('should show warning when no tab is selected', async ({ page }) => {
    const selector = page.locator('#windowSelector');

    // Should show warning message
    await expect(selector.locator('text=NO TAB SELECTED')).toBeVisible();
    await expect(selector.locator('text=Click a tab below to start monitoring')).toBeVisible();
  });

  test('should load available windows from API', async ({ page }) => {
    // Mock the API response
    await page.route('http://localhost:8000/api/windows', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          windows: [
            { title: 'Test Tab 1', x: 0, y: 0, width: 1920, height: 1080 },
            { title: 'Test Tab 2', x: 0, y: 0, width: 1920, height: 1080 }
          ]
        })
      });
    });

    // Click refresh button
    const refreshBtn = page.locator('#refreshWindowsBtn');
    await refreshBtn.click();

    // Wait for windows to load
    await page.waitForTimeout(1000);

    // Check that windows are displayed
    await expect(page.locator('text=Test Tab 1')).toBeVisible();
    await expect(page.locator('text=Test Tab 2')).toBeVisible();
  });

  test('should select a window when clicked', async ({ page }) => {
    // Mock API responses
    await page.route('http://localhost:8000/api/windows', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          windows: [
            { title: 'Roulette Tab', x: 0, y: 0, width: 1920, height: 1080 }
          ]
        })
      });
    });

    await page.route('http://localhost:8000/api/select-window', async route => {
      const body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', window: body.title })
      });
    });

    // Load windows
    const refreshBtn = page.locator('#refreshWindowsBtn');
    await refreshBtn.click();
    await page.waitForTimeout(1000);

    // Click on a window item
    const windowItem = page.locator('.window-item').first();
    await expect(windowItem).toBeVisible();
    await windowItem.click();

    // Wait for selection to complete
    await page.waitForTimeout(500);

    // Check that selected window is shown
    await expect(page.locator('text=Monitoring:')).toBeVisible();
    await expect(page.locator('strong', { hasText: 'Roulette Tab' })).toBeVisible();
  });

  test('should call select-window API when tab is clicked', async ({ page }) => {
    let selectWindowCalled = false;
    let selectWindowData: any = null;

    // Mock API responses
    await page.route('http://localhost:8000/api/windows', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          windows: [
            { title: 'Test Tab', x: 100, y: 200, width: 1920, height: 1080 }
          ]
        })
      });
    });

    await page.route('http://localhost:8000/api/select-window', async route => {
      selectWindowCalled = true;
      selectWindowData = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', window: selectWindowData.title })
      });
    });

    // Load and select window
    await page.locator('#refreshWindowsBtn').click();
    await page.waitForTimeout(1000);
    await page.locator('.window-item').first().click();
    await page.waitForTimeout(500);

    // Verify API was called
    expect(selectWindowCalled).toBe(true);
    expect(selectWindowData).not.toBeNull();
    expect(selectWindowData.title).toBe('Test Tab');
    expect(selectWindowData.x).toBe(100);
    expect(selectWindowData.y).toBe(200);
  });

  test('should reset window selection', async ({ page }) => {
    // Mock API responses
    await page.route('http://localhost:8000/api/windows', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          windows: [
            { title: 'Test Tab', x: 0, y: 0, width: 1920, height: 1080 }
          ]
        })
      });
    });

    await page.route('http://localhost:8000/api/select-window', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', window: 'Test Tab' })
      });
    });

    let resetWindowCalled = false;
    await page.route('http://localhost:8000/api/reset-window', async route => {
      resetWindowCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' })
      });
    });

    // Select a window
    await page.locator('#refreshWindowsBtn').click();
    await page.waitForTimeout(1000);
    await page.locator('.window-item').first().click();
    await page.waitForTimeout(500);

    // Reset selection
    const resetBtn = page.locator('#resetWindowBtn');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(500);

    // Verify reset was called
    expect(resetWindowCalled).toBe(true);

    // Should show warning again
    await expect(page.locator('text=NO TAB SELECTED')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('http://localhost:8000/api/windows', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });

    // Try to load windows
    await page.locator('#refreshWindowsBtn').click();
    await page.waitForTimeout(1000);

    // Should show error message or empty state
    const selector = page.locator('#windowSelector');
    await expect(selector).toBeVisible();
  });

  test('should retry loading windows on failure', async ({ page }) => {
    let callCount = 0;

    await page.route('http://localhost:8000/api/windows', async route => {
      callCount++;
      if (callCount === 1) {
        // First call fails
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      } else {
        // Second call succeeds
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            windows: [
              { title: 'Test Tab', x: 0, y: 0, width: 1920, height: 1080 }
            ]
          })
        });
      }
    });

    // Click refresh - should retry on failure
    await page.locator('#refreshWindowsBtn').click();
    await page.waitForTimeout(2000);

    // Should eventually show windows
    await expect(page.locator('text=Test Tab')).toBeVisible({ timeout: 5000 });
  });
});
