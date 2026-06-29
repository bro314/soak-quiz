import { test, expect } from '@playwright/test';

test.describe('Issue 8: Phase ACTIVE automatically terminated when Validation list is empty', () => {
  const eventId = `issue8-test-${Date.now()}`;
  const adminPassword = 'adminpassword';

  test('Round status should remain ACTIVE after validating the last answer if it was ACTIVE', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const teamContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const teamPage = await teamContext.newPage();

    // 1. Admin: Open landing page and create event
    await adminPage.goto('/');
    await expect(adminPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });

    await adminPage.goto('/admin');
    await adminPage.fill('label:has-text("Event ID") + div input, input[required]:first-of-type', eventId);
    await adminPage.fill('label:has-text("Event Name") + div input', 'Issue 8 Event');
    await adminPage.fill('label:has-text("Maximale Teamgröße") + div input', '6');
    await adminPage.fill('label:has-text("Admin Passwort") + div input', adminPassword);
    await adminPage.click('button:has-text("Event erstellen")');

    await expect(adminPage.locator('h1')).toContainText('Issue 8 Event', { timeout: 10000 });

    // Create Round 1
    const roundTitleInput = adminPage.locator('label:has-text("Titel der Runde") + div input');
    await roundTitleInput.fill('Round 1');
    await adminPage.click('button:has-text("Runde erstellen")');
    await expect(adminPage.locator('table >> text="Round 1"')).toBeVisible();

    // Go to Round 1 Editor to add Questions
    await adminPage.click('table >> text="Round 1"');
    await expect(adminPage.locator('h1')).toContainText('Runde 1: Round 1');

    // Add Question 1 (Free Text)
    const questionTitleInput = adminPage.locator('label:has-text("Frage-Titel") + div input');
    await questionTitleInput.fill('Q1 Free Text');
    await adminPage.click('text="Freitext (Normalisiert)"');
    await adminPage.click('button:has-text("Frage erstellen")');
    await expect(adminPage.locator('text=Q1 Free Text')).toBeVisible();

    // Configure Question 1 (Free Text)
    await adminPage.locator('tr:has-text("Q1 Free Text")').locator('text="Bearbeiten"').click();
    await expect(adminPage.locator('h1')).toContainText('Frage 1 bearbeiten');
    await adminPage.fill('label:has-text("Richtige Antwort") + div input', 'correct answer');
    await adminPage.click('button:has-text("Frage speichern")');
    await adminPage.click('text="Zurück zur Runde"');
    await adminPage.click('text="Zurück zum Dashboard"');

    // Start the Event
    await adminPage.click('button:has-text("Event starten")');
    await expect(adminPage.locator('text=Gestartet (ACTIVE)')).toBeVisible();

    // Team: Register
    await teamPage.goto('/');
    await expect(teamPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });
    await teamPage.goto(`/event/${eventId}/settings`);
    await teamPage.fill('label:has-text("Teamname") + div input', 'Team Rocket');
    await teamPage.fill('label:has-text("Passwort") + div input', 'rocketpass');
    await teamPage.click('button:has-text("Speichern")');
    await expect(teamPage.locator('h1')).toContainText('Issue 8 Event');

    // Admin: Start Round 1
    await adminPage.click('button:has-text("Nächste Runde starten")');
    await expect(adminPage.locator('table >> text="ACTIVE"')).toBeVisible();

    // Admin: Go to Round 1 Editor to activate questions
    await adminPage.click('table >> text="Round 1"');
    await adminPage.locator('tr:has-text("Q1 Free Text")').locator('button:has-text("Inaktiv")').click();
    await expect(adminPage.locator('tr:has-text("Q1 Free Text")').locator('button:has-text("Aktiv")')).toBeVisible();

    // Team: Open Round 1 and Answer Question 1
    await teamPage.click('a:has-text("Round 1")');
    await expect(teamPage.locator('h1')).toContainText('Runde 1: Round 1');
    await teamPage.click('text="Frage 1: Q1 Free Text"');
    await expect(teamPage.locator('h1')).toContainText('Q1 Free Text');
    await teamPage.fill('textarea, input[type="text"]', 'my answer');
    await teamPage.click('button:has-text("Antwort absenden")');
    await expect(teamPage.locator('text=Antwort gespeichert.')).toBeVisible();

    // Admin: Go back to Event Dashboard, then to Validation Screen
    await adminPage.click('text="Zurück zum Dashboard"');
    await adminPage.goto(`/admin/event/${eventId}/validation`);
    await expect(adminPage.locator('h1')).toContainText('Freitext-Fragen validieren');
    await expect(adminPage.locator('text="my answer"')).toBeVisible();

    // Validate the answer
    await adminPage.click('button:has-text("OK")');
    await expect(adminPage.locator('text=Aktuell gibt es keine Freitext-Antworten')).toBeVisible({ timeout: 10000 });

    // Go back to Dashboard and check Round 1 status. It MUST still be ACTIVE, not DONE!
    await adminPage.click('text="Zurück zum Dashboard"');
    await expect(adminPage.locator('tr:has-text("Round 1") >> text="ACTIVE"')).toBeVisible({ timeout: 5000 });
    await expect(adminPage.locator('tr:has-text("Round 1") >> text="DONE"')).not.toBeVisible();
  });
});
