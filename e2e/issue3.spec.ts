import { test, expect } from '@playwright/test';

test.describe('Issue 3 Reproduction', () => {
  const eventId = `issue3-test-${Date.now()}`;
  const adminPassword = 'adminpassword';

  test('Clicking a cell other than the title link text in Rundenliste should navigate', async ({ page }) => {
    // 1. Setup/Bootstrap Auth
    await page.goto('/');
    await expect(page.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });

    // Go to Admin Home and create event
    await page.goto('/admin');
    await page.fill('label:has-text("Event ID") + div input, input[required]:first-of-type', eventId);
    await page.fill('label:has-text("Event Name") + div input', 'Issue 3 Event');
    await page.fill('label:has-text("Maximale Teamgröße") + div input', '6');
    await page.fill('label:has-text("Admin Passwort") + div input', adminPassword);
    await page.click('button:has-text("Event erstellen")');

    await expect(page.locator('h1')).toContainText('Issue 3 Event', { timeout: 10000 });

    // Create Round 1
    const roundTitleInput = page.locator('label:has-text("Titel der Runde") + div input');
    await roundTitleInput.fill('Round 1');
    await page.click('button:has-text("Runde erstellen")');
    await expect(page.locator('table >> text="Round 1"')).toBeVisible();

    // Now try to click the number cell instead of the title link to navigate
    const numberCell = page.locator('table >> text="1"').first();
    await expect(numberCell).toBeVisible();
    await numberCell.click();

    // It should navigate to the round page
    await expect(page.locator('h1')).toContainText('Runde 1: Round 1', { timeout: 5000 });
  });
});
