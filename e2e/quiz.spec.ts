import { test, expect } from '@playwright/test';

test.describe('SoAk Quiz App E2E', () => {
  const eventId = `e2e-test-${Date.now()}`;
  const adminPassword = 'adminpassword';

  test('Step 1 to 4: Full Quiz Workflow', async ({ browser }) => {
    // Create contexts
    const adminContext = await browser.newContext();
    const teamAContext = await browser.newContext();
    const teamBContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const teamAPage = await teamAContext.newPage();
    const teamBPage = await teamBContext.newPage();

    // 1. Admin: Open Landing Page to bootstrap anonymous auth session
    await adminPage.goto('/');
    await expect(adminPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });

    // Go to Admin Home
    await adminPage.goto('/admin');
    await expect(adminPage.locator('h1')).toContainText('Event-Management');

    // 2. Admin: Create a new event
    await adminPage.fill('label:has-text("Event ID") + div input, input[required]:first-of-type', eventId);
    await adminPage.fill('label:has-text("Event Name") + div input', 'E2E Test Event');
    await adminPage.fill('label:has-text("Maximale Teamgröße") + div input', '6');
    await adminPage.fill('label:has-text("Admin Passwort") + div input', adminPassword);
    await adminPage.click('button:has-text("Event erstellen")');

    // 4. Admin: Verify we are on the Event Dashboard
    await expect(adminPage.locator('h1')).toContainText('E2E Test Event', { timeout: 10000 });

    // 5. Admin: Add Round 1
    const roundTitleInput = adminPage.locator('label:has-text("Titel der Runde") + div input');
    await roundTitleInput.fill('Round 1');
    await adminPage.fill('label:has-text("Beschreibung (optional)") + div textarea', 'This is Round 1 description');
    await expect(roundTitleInput).toHaveValue('Round 1');
    await adminPage.click('button:has-text("Runde erstellen")');
    await adminPage.click('text="Zurück zum Dashboard"');
    await expect(adminPage.locator('table >> text="Round 1"')).toBeVisible();

    // 6. Admin: Add Round 2
    const roundTitleInput2 = adminPage.locator('label:has-text("Titel der Runde") + div input');
    await expect(roundTitleInput2).toBeVisible();
    await expect(roundTitleInput2).toHaveValue('');
    await roundTitleInput2.fill('Round 2');
    await adminPage.fill('label:has-text("Beschreibung (optional)") + div textarea', 'This is Round 2 description');
    await expect(roundTitleInput2).toHaveValue('Round 2');
    await adminPage.click('button:has-text("Runde erstellen")');
    await adminPage.click('text="Zurück zum Dashboard"');
    await expect(adminPage.locator('table >> text="Round 2"')).toBeVisible();

    // 7. Admin: Go to Round 1 Editor to add Questions
    await adminPage.click('table >> text="Round 1"');
    await expect(adminPage.locator('h1')).toContainText('Runde 1: Round 1');

    // 8. Admin: Add Question 1 (Multiple Choice)
    const questionTitleInput = adminPage.locator('label:has-text("Frage-Titel") + div input');
    await questionTitleInput.fill('Q1 MC');
    await adminPage.click('button:has-text("Frage erstellen")');

    // 10. Admin: Configure Question 1 (MC)
    await expect(adminPage.locator('h1')).toContainText('Frage 1 bearbeiten');
    await adminPage.fill('label:has-text("Option 1") + div input', 'Choice A');
    await adminPage.fill('label:has-text("Option 2") + div input', 'Choice B');
    await adminPage.fill('label:has-text("Option 3") + div input', 'Choice C');
    await adminPage.fill('label:has-text("Option 4") + div input', 'Choice D');
    await adminPage.click('input[type="radio"] >> nth=1');
    await adminPage.click('button:has-text("Frage speichern")');
    await adminPage.click('text="Zurück zur Runde"');

    // 9. Admin: Add Question 2 (Free Text)
    const titleInput2 = adminPage.locator('label:has-text("Frage-Titel") + div input');
    await expect(titleInput2).toBeVisible();
    await expect(titleInput2).toHaveValue('');
    await titleInput2.fill('Q2 FT');
    await adminPage.click('text="Freitext (Normalisiert)"');
    await adminPage.click('button:has-text("Frage erstellen")');

    // 11. Admin: Configure Question 2 (FT)
    await expect(adminPage.locator('h1')).toContainText('Frage 2 bearbeiten');
    await adminPage.fill('label:has-text("Richtige Antwort") + div input', 'Munich');
    await adminPage.click('button:has-text("Frage speichern")');
    await adminPage.click('text="Zurück zur Runde"');
    await adminPage.click('text="Zurück zum Dashboard"');

    // 12. Admin: Start the Event
    await adminPage.click('button:has-text("Event starten")');
    await expect(adminPage.locator('text=Gestartet (ACTIVE)')).toBeVisible();

    // --- STEP 2: TEAM REGISTRATION ---

    // 13. Team A: Bootstrap auth and navigate directly to Settings page to register
    await teamAPage.goto('/');
    await expect(teamAPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });
    await teamAPage.goto(`/event/${eventId}/settings`);
    await expect(teamAPage.locator('h1')).toContainText('Team erstellen');

    // 14. Team A: Register
    await teamAPage.fill('label:has-text("Teamname") + div input', 'Team Rocket');
    await teamAPage.fill('label:has-text("Passwort") + div input', 'rocketpass');
    await teamAPage.fill('label:has-text("Teilnehmernamen") + div textarea', 'Jessie, James, Meowth');
    await teamAPage.click('button:has-text("Speichern")');

    // 15. Team A: Verify landing on EventHomeScreen
    await expect(teamAPage.locator('h1')).toContainText('E2E Test Event');
    await expect(teamAPage.locator('text=Platz 1 von 1')).toBeVisible();

    // 16. Team B: Bootstrap auth and navigate directly to Settings page to register
    await teamBPage.goto('/');
    await expect(teamBPage.locator('text=Verbunden')).toBeVisible({ timeout: 10000 });
    await teamBPage.goto(`/event/${eventId}/settings`);
    await expect(teamBPage.locator('h1')).toContainText('Team erstellen');

    // 17. Team B: Register
    await teamBPage.fill('label:has-text("Teamname") + div input', 'Team Aqua');
    await teamBPage.fill('label:has-text("Passwort") + div input', 'aquapass');
    await teamBPage.fill('label:has-text("Teilnehmernamen") + div textarea', 'Archie, Matt, Shelly');
    await teamBPage.click('button:has-text("Speichern")');

    // 18. Team B: Verify landing on EventHomeScreen
    await expect(teamBPage.locator('h1')).toContainText('E2E Test Event');
    await expect(teamBPage.locator('text=Platz 1 von 2')).toBeVisible();

    // 19. Team A: Verify updated placement (Team Aqua is alphabetically first, so Team A is Platz 2)
    await expect(teamAPage.locator('text=Platz 2 von 2')).toBeVisible();

    // --- STEP 3 & 4: GAMEPLAY & SCORING ---

    // 20. Admin: Start Round 1
    await adminPage.click('button:has-text("Nächste Runde starten")');
    await expect(adminPage.locator('table >> text="ACTIVE"')).toBeVisible();

    // 21. Admin: Open Round 1 Editor to activate questions
    await adminPage.click('table >> text="Round 1"');
    await expect(adminPage.locator('h1')).toContainText('Runde 1: Round 1');

    // 22. Admin: Activate Question 1 (MC)
    await adminPage.locator('tr:has-text("Q1 MC")').click();
    await adminPage.selectOption('label:has-text("Status") + div select', 'ACTIVE');
    await adminPage.click('button:has-text("Frage speichern")');
    await adminPage.click('text="Zurück zur Runde"');
    await expect(adminPage.locator('tr:has-text("Q1 MC") >> text="ACTIVE"')).toBeVisible();

    // 23. Team A: Open Round 1 and Answer Question 1 (Correct: Choice B)
    await teamAPage.click('a:has-text("Round 1")');
    await expect(teamAPage.locator('h1')).toContainText('Runde 1: Round 1');
    await teamAPage.click('text="Frage 1: Q1 MC"');
    await expect(teamAPage.locator('h1')).toContainText('Q1 MC');
    await teamAPage.click('text="Choice B"');
    await expect(teamAPage.locator('text=Antwort gespeichert.')).toBeVisible();
    
    // Change answer on MC question to Choice C
    await teamAPage.click('text="Choice C"');
    await expect(teamAPage.locator('text=Antwort gespeichert.')).toBeVisible();

    // Change answer on MC question back to Choice B
    await teamAPage.click('text="Choice B"');
    await expect(teamAPage.locator('text=Antwort gespeichert.')).toBeVisible();
    await teamAPage.click('text="Zurück zur Runde"');

    // 24. Team B: Open Round 1 and Answer Question 1 (Incorrect: Choice C)
    await teamBPage.click('a:has-text("Round 1")');
    await expect(teamBPage.locator('h1')).toContainText('Runde 1: Round 1');
    await teamBPage.click('text="Frage 1: Q1 MC"');
    await expect(teamBPage.locator('h1')).toContainText('Q1 MC');
    await teamBPage.click('text="Choice C"');
    await expect(teamBPage.locator('text=Antwort gespeichert.')).toBeVisible();
    await teamBPage.click('text="Zurück zur Runde"');

    // 25. Admin: Activate Question 2 (Free Text)
    await adminPage.locator('tr:has-text("Q2 FT")').click();
    await adminPage.selectOption('label:has-text("Status") + div select', 'ACTIVE');
    await adminPage.click('button:has-text("Frage speichern")');
    await adminPage.click('text="Zurück zur Runde"');
    await expect(adminPage.locator('tr:has-text("Q2 FT") >> text="ACTIVE"')).toBeVisible();

    // 26. Team A: Answer Question 2 (Correct: Munich, gets auto-graded and validation suggested)
    await teamAPage.click('text="Frage 2: Q2 FT"');
    await expect(teamAPage.locator('h1')).toContainText('Q2 FT');
    // Reproduction test: Verify the input is currently empty and does not contain "Choice B" from Q1!
    await expect(teamAPage.locator('label:has-text("Deine Antwort") + div input')).toHaveValue('');
    await teamAPage.fill('label:has-text("Deine Antwort") + div input', '   munich!!  ');
    await teamAPage.click('button:has-text("Antwort absenden")');
    await expect(teamAPage.locator('text=Antwort gespeichert.')).toBeVisible();

    // Re-enter and edit answer
    await teamAPage.click('text="Zurück zur Runde"');
    await teamAPage.click('text="Frage 2: Q2 FT"');
    await expect(teamAPage.locator('label:has-text("Deine Antwort") + div input')).toHaveValue('   munich!!  ');
    await teamAPage.fill('label:has-text("Deine Antwort") + div input', '  mUnIcH  ');
    await teamAPage.click('button:has-text("Antwort absenden")');
    await expect(teamAPage.locator('text=Antwort gespeichert.')).toBeVisible();
    await teamAPage.click('text="Zurück zur Runde"');

    // 27. Team B: Answer Question 2 (Incorrect: Berlin)
    await teamBPage.click('text="Frage 2: Q2 FT"');
    await expect(teamBPage.locator('h1')).toContainText('Q2 FT');
    // Reproduction test: Verify the input is currently empty and does not contain "Choice C" from Q1!
    await expect(teamBPage.locator('label:has-text("Deine Antwort") + div input')).toHaveValue('');
    await teamBPage.fill('label:has-text("Deine Antwort") + div input', 'Berlin');

    await teamBPage.click('button:has-text("Antwort absenden")');
    await expect(teamBPage.locator('text=Antwort gespeichert.')).toBeVisible();
    await teamBPage.click('text="Zurück zur Runde"');

    // 28. Admin: Close Round 1
    await adminPage.click('text="Zurück zum Dashboard"');
    await adminPage.click('button:has-text("Aktuelle Runde schließen")');
    await expect(adminPage.locator('table >> text="VALIDATION"')).toBeVisible();

    // 29. Admin: Validate Free Text Answers
    await adminPage.click('a:has-text("Validierung")');
    await expect(adminPage.locator('h1')).toContainText('Freitext-Fragen validieren');
    
    // Auto-grader normalize suggested 1 point for Team Rocket, 0 points for Team Aqua. Click OK for both.
    await adminPage.locator('tr:has-text("Team Rocket")').locator('button:has-text("OK")').click();
    await adminPage.locator('tr:has-text("Team Aqua")').locator('button:has-text("OK")').click();

    // Verify all answers are validated (table becomes empty or has message)
    await expect(adminPage.locator('text=Aktuell gibt es keine Freitext-Antworten')).toBeVisible();

    // 30. Verify Scoreboard and Round status updates to DONE
    await adminPage.click('text="Zurück zum Dashboard"');
    await expect(adminPage.locator('table >> text="DONE"')).toBeVisible();

    // Verify total points in admin dashboard scoreboard table
    await expect(adminPage.locator('tr:has-text("Team Rocket")').locator('td >> nth=0')).toContainText('2'); // Round 1 score
    await expect(adminPage.locator('tr:has-text("Team Rocket")').locator('td >> nth=2')).toContainText('2'); // Total score
    await expect(adminPage.locator('tr:has-text("Team Aqua")').locator('td >> nth=0')).toContainText('0');
    await expect(adminPage.locator('tr:has-text("Team Aqua")').locator('td >> nth=2')).toContainText('0');

    // Team A: Verify new placement (now 1 von 2)
    await teamAPage.click('text="Zurück zur Übersicht"');
    await expect(teamAPage.locator('text=Platz 1 von 2')).toBeVisible();

    // Team B: Verify new placement (now 2 von 2)
    await teamBPage.click('text="Zurück zur Übersicht"');
    await expect(teamBPage.locator('text=Platz 2 von 2')).toBeVisible();
  });
});
