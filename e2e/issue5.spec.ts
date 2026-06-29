import { test, expect } from '@playwright/test';

test.describe('Issue 5 Reproduction', () => {
  const eventId = `issue5-test-${Date.now()}`;
  const adminPassword = 'adminpassword';

  test('More than one round active at a time should not be allowed', async ({ page }) => {
    // 1. Setup/Bootstrap Auth
    await page.goto('/');
    await expect(page.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });

    // Go to Admin Home and create event
    await page.goto('/admin');
    await page.fill('label:has-text("Event ID") + div input, input[required]:first-of-type', eventId);
    await page.fill('label:has-text("Event Name") + div input', 'Issue 5 Event');
    await page.fill('label:has-text("Maximale Teamgröße") + div input', '6');
    await page.fill('label:has-text("Admin Passwort") + div input', adminPassword);
    await page.click('button:has-text("Event erstellen")');

    await expect(page.locator('h1')).toContainText('Issue 5 Event', { timeout: 10000 });

    // Create Round 1
    const roundTitleInput = page.locator('label:has-text("Titel der Runde") + div input');
    await roundTitleInput.fill('Round 1');
    await page.click('button:has-text("Runde erstellen")');
    await expect(page.locator('table >> text="Round 1"')).toBeVisible();

    // Create Round 2
    // Wait for the title input to be cleared first
    await expect(roundTitleInput).toHaveValue('');
    await roundTitleInput.fill('Round 2');
    await page.click('button:has-text("Runde erstellen")');
    await expect(page.locator('table >> text="Round 2"')).toBeVisible();

    // Start event
    await page.click('button:has-text("Event starten")');
    await expect(page.locator('text=Gestartet (ACTIVE)')).toBeVisible();

    // Start Round 1
    const startNextRoundBtn = page.locator('button:has-text("Nächste Runde starten")');
    await expect(startNextRoundBtn).toBeEnabled();
    await startNextRoundBtn.click();

    // Round 1 should be ACTIVE, Round 2 should be INACTIVE
    await expect(page.locator('tr:has-text("Round 1") >> text="ACTIVE"')).toBeVisible();
    await expect(page.locator('tr:has-text("Round 2") >> text="INACTIVE"')).toBeVisible();

    // The button "Nächste Runde starten" should now be disabled because there is an active round!
    await expect(startNextRoundBtn).toBeDisabled();
  });
});
