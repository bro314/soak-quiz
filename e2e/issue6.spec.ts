import { test, expect } from '@playwright/test';

test.describe('Issue 6: Status validation phase although no answer is left to validate', () => {
  const eventId = `issue6-test-${Date.now()}`;
  const adminPassword = 'adminpassword';

  test('Round should transition to DONE or have button to complete validation', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const teamContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const teamPage = await teamContext.newPage();

    // 1. Admin: Open landing page and create event
    await adminPage.goto('/');
    await expect(adminPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });

    await adminPage.goto('/admin');
    await adminPage.fill('label:has-text("Event ID") + div input, input[required]:first-of-type', eventId);
    await adminPage.fill('label:has-text("Event Name") + div input', 'Issue 6 Event');
    await adminPage.fill('label:has-text("Maximale Teamgröße") + div input', '6');
    await adminPage.fill('label:has-text("Admin Passwort") + div input', adminPassword);
    await adminPage.click('button:has-text("Event erstellen")');

    await expect(adminPage.locator('h1')).toContainText('Issue 6 Event', { timeout: 10000 });

    // Create Round 1
    const roundTitleInput = adminPage.locator('label:has-text("Titel der Runde") + div input');
    await roundTitleInput.fill('Round 1');
    await adminPage.click('button:has-text("Runde erstellen")');
    await expect(adminPage.locator('h1')).toContainText('Runde 1: Round 1');

    // Add Question 1 (Multiple Choice)
    const questionTitleInput = adminPage.locator('label:has-text("Frage-Titel") + div input');
    await questionTitleInput.fill('Q1 MC');
    await adminPage.click('button:has-text("Frage erstellen")');
    // Configure Question 1 (MC)
    await expect(adminPage.locator('h1')).toContainText('Frage 1 bearbeiten');
    await adminPage.fill('label:has-text("Option 1") + div input', 'Choice A');
    await adminPage.fill('label:has-text("Option 2") + div input', 'Choice B');
    await adminPage.fill('label:has-text("Option 3") + div input', 'Choice C');
    await adminPage.fill('label:has-text("Option 4") + div input', 'Choice D');
    await adminPage.click('input[type="radio"] >> nth=1'); // Select Choice B
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
    await expect(teamPage.locator('h1')).toContainText('Issue 6 Event');

    // Admin: Start Round 1
    await adminPage.click('button:has-text("Nächste Runde starten")');
    await expect(adminPage.locator('table >> text="ACTIVE"')).toBeVisible();

    // Admin: Go to Round 1 Editor to activate questions
    await adminPage.click('table >> text="Round 1"');
    await adminPage.locator('tr:has-text("Q1 MC")').click();
    await adminPage.selectOption('label:has-text("Status") + div select', 'ACTIVE');
    await adminPage.click('button:has-text("Frage speichern")');
    await adminPage.click('text="Zurück zur Runde"');
    await expect(adminPage.locator('tr:has-text("Q1 MC") >> text="ACTIVE"')).toBeVisible();

    // Team: Open Round 1 and Answer Question 1
    await teamPage.click('a:has-text("Round 1")');
    await expect(teamPage.locator('h1')).toContainText('Runde 1: Round 1');
    await teamPage.click('text="Frage 1: Q1 MC"');
    await expect(teamPage.locator('h1')).toContainText('Q1 MC');
    await teamPage.click('text="Choice B"');
    await expect(teamPage.locator('h1')).toContainText('Runde 1: Round 1');

    // Admin: Go back to Event Dashboard
    await adminPage.click('text="Zurück zum Dashboard"');

    // Wait for the Cloud Function to finish grading and updating scoreboard while the round is still ACTIVE
    await adminPage.waitForTimeout(4000);

    // Admin: Close Round 1
    await adminPage.click('button:has-text("Aktuelle Runde schließen")');

    // Since it was Multiple Choice, it is auto-validated.
    // The round should either auto-transition to DONE, or we should see the "Runde abschließen" / "Validierung abschließen" button.
    // Let's assert that the round status is DONE.
    await expect(adminPage.locator('tr:has-text("Round 1") >> text="DONE"')).toBeVisible({ timeout: 10000 });
  });
});
