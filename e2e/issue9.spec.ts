import { test, expect } from '@playwright/test';

test.describe('Issue 9: Prefilled answers to Freitext questions', () => {
  const eventId = `issue9-test-${Date.now()}`;
  const adminPassword = 'adminpassword';

  test('Input field should be empty when navigating to an unanswered free text question', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const teamContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const teamPage = await teamContext.newPage();

    // 1. Admin: Open landing page and create event
    await adminPage.goto('/');
    await expect(adminPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });

    await adminPage.goto('/admin');
    await adminPage.fill('label:has-text("Event ID") + div input, input[required]:first-of-type', eventId);
    await adminPage.fill('label:has-text("Event Name") + div input', 'Issue 9 Event');
    await adminPage.fill('label:has-text("Maximale Teamgröße") + div input', '6');
    await adminPage.fill('label:has-text("Admin Passwort") + div input', adminPassword);
    await adminPage.click('button:has-text("Event erstellen")');

    await expect(adminPage.locator('h1')).toContainText('Issue 9 Event', { timeout: 10000 });

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

    // Await input field to be cleared to prevent Vite state race conditions
    await expect(questionTitleInput).toHaveValue('');

    // Add Question 2 (Free Text)
    await questionTitleInput.fill('Q2 Free Text');
    await adminPage.click('text="Freitext (Normalisiert)"');
    await adminPage.click('button:has-text("Frage erstellen")');
    await expect(adminPage.locator('text=Q2 Free Text')).toBeVisible();

    // Configure Question 1
    await adminPage.locator('tr:has-text("Q1 Free Text")').locator('text="Bearbeiten"').click();
    await expect(adminPage.locator('h1')).toContainText('Frage 1 bearbeiten');
    await adminPage.fill('label:has-text("Richtige Antwort") + div input', 'answer one');
    await adminPage.click('button:has-text("Frage speichern")');
    await adminPage.click('text="Zurück zur Runde"');

    // Configure Question 2
    await adminPage.locator('tr:has-text("Q2 Free Text")').locator('text="Bearbeiten"').click();
    await expect(adminPage.locator('h1')).toContainText('Frage 2 bearbeiten');
    await adminPage.fill('label:has-text("Richtige Antwort") + div input', 'answer two');
    await adminPage.click('button:has-text("Frage speichern")');
    await adminPage.click('text="Zurück zur Runde"');

    // Start Round 1 and activate both questions
    await adminPage.click('text="Zurück zum Dashboard"');
    await adminPage.click('button:has-text("Event starten")');
    await expect(adminPage.locator('text=Gestartet (ACTIVE)')).toBeVisible();

    await adminPage.click('button:has-text("Nächste Runde starten")');
    await expect(adminPage.locator('table >> text="ACTIVE"')).toBeVisible();

    await adminPage.click('table >> text="Round 1"');
    await adminPage.locator('tr:has-text("Q1 Free Text")').locator('button:has-text("Inaktiv")').click();
    await expect(adminPage.locator('tr:has-text("Q1 Free Text")').locator('button:has-text("Aktiv")')).toBeVisible();

    await adminPage.locator('tr:has-text("Q2 Free Text")').locator('button:has-text("Inaktiv")').click();
    await expect(adminPage.locator('tr:has-text("Q2 Free Text")').locator('button:has-text("Aktiv")')).toBeVisible();

    // Team: Register
    await teamPage.goto('/');
    await expect(teamPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });
    await teamPage.goto(`/event/${eventId}/settings`);
    await teamPage.fill('label:has-text("Teamname") + div input', 'Team Rocket');
    await teamPage.fill('label:has-text("Passwort") + div input', 'rocketpass');
    await teamPage.click('button:has-text("Speichern")');
    await expect(teamPage.locator('h1')).toContainText('Issue 9 Event');

    // Team: Open Round 1 and Answer Question 1
    await teamPage.click('a:has-text("Round 1")');
    await expect(teamPage.locator('h1')).toContainText('Runde 1: Round 1');
    await teamPage.click('text="Frage 1: Q1 Free Text"');
    await expect(teamPage.locator('h1')).toContainText('Q1 Free Text');
    
    // Type and submit answer for Q1
    await teamPage.fill('textarea, input[type="text"]', 'my answer 1');
    await teamPage.click('button:has-text("Antwort absenden")');
    await expect(teamPage.locator('text=Antwort gespeichert.')).toBeVisible();

    // Navigate to Question 2 using "Nächste" button
    await teamPage.click('text="Nächste"');
    await expect(teamPage.locator('h1')).toContainText('Q2 Free Text');

    // The input field for Q2 should be empty, not contain "my answer 1"
    const answerInputLocator = teamPage.locator('label:has-text("Deine Antwort") + div input, textarea, input[type="text"]');
    await expect(answerInputLocator).toHaveValue('');
  });
});
