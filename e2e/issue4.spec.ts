import { test, expect } from '@playwright/test';

test.describe('Issue 4 Reproduction', () => {
  const eventId = `issue4-test-${Date.now()}`;
  const adminPassword = 'adminpassword';

  test('Directly joining event page without landing on root first', async ({ browser }) => {
    // 1. Admin: Open Admin Home to bootstrap auth and create event
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/');
    await expect(adminPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });

    await adminPage.goto('/admin');
    await adminPage.fill('label:has-text("Event ID") + div input, input[required]:first-of-type', eventId);
    await adminPage.fill('label:has-text("Event Name") + div input', 'Issue 4 Event');
    await adminPage.fill('label:has-text("Maximale Teamgröße") + div input', '6');
    await adminPage.fill('label:has-text("Admin Passwort") + div input', adminPassword);
    await adminPage.click('button:has-text("Event erstellen")');

    await expect(adminPage.locator('h1')).toContainText('Issue 4 Event', { timeout: 10000 });
    await adminPage.click('button:has-text("Event starten")');
    await expect(adminPage.locator('text=Gestartet (ACTIVE)')).toBeVisible();

    // 2. Participant: Navigate directly to /event/:eventId in a clean context
    const participantContext = await browser.newContext();
    const participantPage = await participantContext.newPage();
    
    // Go directly to the event page (bypassing root /)
    await participantPage.goto(`/event/${eventId}`);

    // Expect the event title to be shown instead of "Fehler beim Laden des Events."
    await expect(participantPage.locator('h1')).toContainText('Issue 4 Event', { timeout: 5000 });
    await expect(participantPage.locator('text=Fehler beim Laden des Events.')).not.toBeVisible();

    // Click "Team erstellen"
    await participantPage.click('a:has-text("Team erstellen")');
    await expect(participantPage.locator('h1')).toContainText('Team erstellen');

    // Fill team name and members, submit
    await participantPage.fill('label:has-text("Teamname") + div input', 'Issue 4 Team');
    await participantPage.fill('label:has-text("Passwort") + div input', 'teampassword');
    await participantPage.fill('label:has-text("Teilnehmernamen") + div textarea', 'Alice, Bob');
    await participantPage.click('button:has-text("Speichern")');

    // Wait and verify we are redirected to /event/:eventId/home and are logged in
    await expect(participantPage.locator('text=Eingeloggt als: Issue 4 Team')).toBeVisible({ timeout: 10000 });
  });
});
