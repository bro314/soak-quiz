# SoAk Quiz App — Implementation Plan

> **Audience:** an AI coding agent (e.g. Claude Code) executing milestone-by-milestone.
> **Source spec:** "SoAk Quiz App" (German). This plan is the build contract derived from it.
> **Language rule (from spec):** All UI strings are **German**. All code, filenames, identifiers, and comments are **English**. No i18n framework.

---

## 1. Locked decisions & assumptions

| # | Decision | Choice | Consequence |
|---|----------|--------|-------------|
| D1 | Plan consumer | AI coding agent | Tasks are explicit, sequenced, each milestone ends in a runnable + verifiable state. |
| D2 | Real-time updates | **Firestore `onSnapshot` listeners** | No FCM, no push-notification plumbing. Status changes propagate live to subscribed clients. |
| D3 | Answer secrecy | **Strict** | Correct answers and other teams' answers must be *unreadable from the DB*, enforced by Firestore Security Rules + a trusted identity, not by UI hiding. |

**Stated defaults (not in spec — change if wrong):**
- Database: **Cloud Firestore** (not Realtime Database) — required for `onSnapshot` + per-document rules.
- Frontend: **Vite + React + TypeScript + MUI** (Material UI, latest stable). Routing via **React Router**.
- Serverless: **Firebase Cloud Functions (2nd gen)** for the two functions below. No long-running server.
- Identity: **Firebase Anonymous Auth** on every device, elevated by **custom claims** set server-side after password check.
- Passwords stored as **hashes** (e.g. bcrypt/argon2) in admin-only docs; never client-readable, never compared client-side.
- Develop directly against the **live `soak-quiz-app` project** (devving on prod data is fine). The only local emulator is a throwaway **Firestore instance for security-rules unit tests** — the rules-testing SDK requires it; it isn't part of the normal dev loop.
- Firebase project: ID `soak-quiz-app`, number `265060520602`.
- Git repository: **`https://github.com/bro314/soak-quiz`** (public, currently **empty** — M0 initializes it with the initial commit).

> During implementation, **load the Firebase skills first** (per the spec's instruction) before writing any Firebase config, rules, or functions.

---

## 2. Why strict secrecy drives the architecture

A pure client-side Firebase app sends the browser straight to the database. Therefore:

- **Field-level hiding is impossible** in Firestore rules — rules grant read/deny at the *document* level. Any secret must live in its **own document**, in a path participants' rules deny.
- **Identity must be trustworthy.** Team/admin passwords are verified **server-side** by a callable function, which then writes **custom claims** (`{ role, eventId, teamId }`) onto the device's anonymous user. Rules key off `request.auth.token`, so a client cannot forge "I am team 3" or "I am admin."
- **Grading cannot happen on the participant client**, because that client may never read the correct answer. A Firestore-triggered function (which runs with admin privileges) does the grading and writes only the *result* (points, validated flag) plus a numbers-only scoreboard.

This is the minimum serverless footprint that satisfies strict secrecy while honoring "no server I have to run."

---

## 3. Firestore data model

Secrecy is achieved by splitting each entity into **public-min**, **gated-detail**, and **secret** documents.

```
events/{eventId}
  name, maxTeamSize (default 6), status: "INACTIVE" | "ACTIVE"
  events/{eventId}/secret/auth        -> { adminPasswordHash }            (admin only)

events/{eventId}/teams/{teamId}
  name, memberNames (string), createdAt
  events/{eventId}/teams/{teamId}/secret/auth -> { teamPasswordHash, joinToken }  (functions/admin only)

events/{eventId}/rounds/{roundId}
  number (int, unique in event), title, status: "INACTIVE"|"ACTIVE"|"VALIDATION"|"DONE"
  events/{eventId}/rounds/{roundId}/detail/main -> { description }
        (readable by event members only when round.status != "INACTIVE")

events/{eventId}/rounds/{roundId}/questions/{questionId}
  number (int, unique in round), type: "MULTIPLE_CHOICE"|"FREE_TEXT",
  title, status: "INACTIVE"|"ACTIVE"
  .../detail/main   -> { content, possibleAnswers: string[] }
        (readable by event members only when question.status == "ACTIVE")
  .../secret/answer -> { correctAnswer: string }                         (admin only; grader reads via Admin SDK)

events/{eventId}/answers/{teamId}__{questionId}
  teamId, roundId, questionId, answerText, submittedAt (serverTimestamp),
  points (number, default 0), validated (bool), gradedAt
        read: own team + admin.   write answerText: own team (when allowed).
        write points/validated: grader function or admin only.
  (optional) .../submissions/{autoId}  append-only audit of every attempt; "latest counts" is satisfied by overwriting the parent doc.

events/{eventId}/scoreboard/{teamId}
  perRound: { [roundId]: number }, total: number, updatedAt
        readable by all event members (numbers only — no answer content). Maintained by grader.
```

**Number auto-assignment (rounds & questions):** smallest integer ≥ 1 not already used among siblings, but editable by the admin.

---

## 4. Security rules — invariants to satisfy

Write rules **deny-by-default**, then allow precisely these. Each must be covered by a rules unit test (Milestone 1).

1. A participant of event E can read public-min docs of E (event, teams, rounds, questions, scoreboard).
2. `rounds/{r}/detail` readable only if `round.status != "INACTIVE"` (use `get()` on the round).
3. `questions/{q}/detail` readable only if `question.status == "ACTIVE"`.
4. `questions/{q}/secret/answer` — **never** readable by a participant; readable only by `role == "admin"` of that event.
5. `answers/{teamId}__{questionId}` readable only by that team or an event admin. A team can **never** read another team's answer doc.
6. A team may create/overwrite `answerText` on its own answer doc **only when** `question.status == "ACTIVE"` **and** `round.status` ∉ {`VALIDATION`,`DONE`}.
7. A team may **not** write `points` or `validated`; only the grader/admin may.
8. Only event admins may write events/rounds/questions structure and status transitions.
9. `secret/auth` docs (password hashes, tokens) are readable/writable only by functions/admin — never by participants.

---

## 5. Status state machines (admin-driven)

**Round:** `INACTIVE → ACTIVE → VALIDATION → DONE`
- `INACTIVE→ACTIVE`: "Nächste Runde starten" (only one round ACTIVE at a time recommended).
- `ACTIVE→VALIDATION`: "Aktuelle Runde schließen" — answering stops immediately (rule #6).
- `VALIDATION→DONE`: **automatic**, by grader, once **all** free-text answers in the round have `validated == true`.

**Question:** `INACTIVE → ACTIVE`
- "Nächste Frage der aktuellen Runde aktivieren" flips the next question to ACTIVE.

**Event:** `INACTIVE → ACTIVE` ("Event starten"; ACTIVE = teams may register). **Reset** (admin, with confirmation): delete all teams + answers + scoreboard, set event/rounds/questions back to INACTIVE.

---

## 6. Cloud Functions (serverless)

**F1 — Auth/identity (callable, `onCall`):**
- `createTeam(eventId, name, password, memberNames)` → creates team + hashed password + joinToken; sets caller's claims `{ role:"team", eventId, teamId }`.
- `loginTeam(eventId, teamId, password)` → verify hash → set claims.
- `joinTeamByToken(eventId, teamId, token)` → QR login without password (for additional team members) → set claims.
- `loginAdmin(eventId, password)` → verify hash → claims `{ role:"admin", eventId }`.
- All hashing/verification server-side. Refresh the client ID token after claims change.

**F2 — Grading & aggregation (Firestore trigger on `answers/*` write):**
- Read sibling secret correct answer + question type.
- **MC:** `points = (answerText == correctAnswer) ? 1 : 0`; `validated = true` (no human step).
- **Free text:** normalize both sides — strip all chars not `[a-zA-Z]`, lowercase, then string-equality → suggested `points` (1/0); `validated = false` (admin must confirm).
- Write `points`/`validated` back; recompute `scoreboard/{teamId}` (perRound + total).
- After write, if round is `VALIDATION` and **all** its free-text answers are `validated`, transition round → `DONE`.
- "Latest answer counts" is naturally satisfied because the answer doc is overwritten per (team, question).

---

## 7. Frontend structure

```
src/
  firebase/            init, auth bootstrap (anonymous), callable wrappers
  types/               shared TS interfaces (Event, Round, Question, Answer, Team, Scoreboard)
  hooks/               useDoc/useCollection onSnapshot helpers, useClaims
  routes/              React Router config (participant + admin trees)
  participant/         (mobile-first)
    EventScreen, TeamLoginScreen, EventHomeScreen, SettingsScreen, RoundScreen, QuestionScreen
  admin/               (laptop-first)
    AdminHome, EventDashboard, RoundEditor, QuestionEditor, ValidationScreen
  components/          shared MUI components, status chips, score tables
```

**Real-time subscription map (all `onSnapshot`):**
- Participant EventHome → rounds list + `scoreboard` (ranking) + own scoreboard doc.
- RoundScreen → that round + its questions.
- QuestionScreen → that question + own answer doc.
- Admin dashboards → event, rounds, questions, answers, scoreboard.

---

## 8. Screens

Build each screen to match the spec exactly. Status names below are the English enums (§5); all user-facing text is German.

### 8.1 Participant screens (mobile-first)

**EventScreen** — reached via the QR code printed on the tables (the URL carries the `eventId`).
- "Team erstellen" link → SettingsScreen in create mode.
- List of **all** teams in the event. Selecting a team prompts for the team password; on success → EventHomeScreen.

**EventHomeScreen ("Event eingeloggt")**
- List of rounds, each showing **title, status, and (if available) the own team's points** for that round.
  - A round is clickable only when its status ≠ INACTIVE → RoundScreen.
- Current placement of the own team, e.g. "Platz 6 von 15".
- Link to SettingsScreen.
- Logout button → back to EventScreen.

**SettingsScreen ("Einstellungen")**
- Team name — editable **only at creation**, read-only afterward.
- Password — editable **only at creation**, read-only afterward.
  - Optionally display a QR code that logs **other team members** in without entering the password.
- Participant names as a single free-text field (e.g. "Jonathan, Robin, Daniel, Ben") — editable **at any time**.
- Buttons: "Speichern", "Abbrechen".

**RoundScreen ("Runde")**
- Round title and number.
- Description — **hidden while the round is INACTIVE**.
- List of questions, each with its state (unlocked? answered?) — **hidden while the round is INACTIVE**.
  - Each question is clickable → QuestionScreen.
- Navigation: back to EventHomeScreen.

**QuestionScreen ("Frage")**
- Round title and number.
- Question title and number.
- If the question is INACTIVE: show the text "Frage noch nicht freigeschaltet".
- Content/description (may be empty) — visible **only when the question is ACTIVE**.
- Answer entry — visible **only when the question is ACTIVE**:
  - Multiple Choice: one button per choice; tapping it saves the answer and advances to the next question.
  - Free text: a single input box with a "Speichern" button.
- Navigation: previous question, next question, back to RoundScreen.

### 8.2 Admin screens (laptop-first)

**AdminHome ("Home")**
- "Event erstellen".
- List of events.

**EventDashboard (create / edit / view)**
- Inputs: admin password; max persons per team.
- List of rounds — per round show **title, status, and number of questions**; each round clickable; "Runde hinzufügen" button.
- Score table: one **row per team**, one **column per round**, with totals for **both** each team (row) and each round (column).
- Action buttons:
  - **Event reset** (for testing, behind a confirmation dialog): delete all teams; reset the status of the event, all rounds, and all questions.
  - Event starten.
  - Nächste Runde starten.
  - Aktuelle Runde schließen.
  - Nächste Frage der aktuellen Runde aktivieren.

**RoundEditor (create / edit / view)**
- Inputs: **number** (auto-assigned as the smallest integer ≥ 1 not yet used by another round in the event, but editable); title; description.
- List of questions — per question show **title and status**; each clickable; "Frage hinzufügen" button.
- Score table for this round: one **row per team**, one **column per question**, with totals for **both** each team (row) and each question (column).

**QuestionEditor (create / edit / view)**
- **Number** (auto-assigned as the smallest integer ≥ 1 not yet used by another question in the round, but editable).
- Title.
- Question content/description (optional; shown if provided, otherwise "siehe Präsentation").
- Type (Multiple Choice or Free text).
- For **Multiple Choice**: list of possible answers, each a string; a radio button marks the correct one, but the correct answer is **stored as a separate string** in the secret `correctAnswer` field — never co-located with the public choices.
- For **Free text**: the correct answer as a string. Auto-grading first decides correctness by removing every character not in `[a-zA-Z]`, lowercasing, then testing string equality.

**ValidationScreen ("Freitext-Fragen validieren")**
- One long list/table of free-text team answers with `validated == false`, **not** scoped to a single round or question. Each row shows: round number, question number, question title, correct answer, team name, the team's answer, an **editable** points value, and an "OK" button that saves the points and sets `validated = true`.
- When a round is in VALIDATION **and** all of its free-text answers are validated, the round's status changes to DONE automatically.

---

## 9. Milestones (each ends runnable + verifiable)

**M0 — Repo, scaffolding & Firebase setup.** Clone `https://github.com/bro314/soak-quiz` (empty) and make the initial commit; Vite+React+TS+MUI; Firebase init (Firestore, Hosting, Functions, Anonymous Auth) wired to the live `soak-quiz-app` project.
*Done when:* the repo holds a committed, pushed scaffold; app runs locally against the live project and deploys a placeholder page.

**M1 — Types, data model & security rules + tests.** Shared TS interfaces; deny-by-default rules implementing §4; rules unit tests (`@firebase/rules-unit-testing`).
*Done when:* all §4 invariants pass as tests (esp. participant cannot read `secret/answer` or other teams' answers).

**M2 — Auth (F1) & login flows.** Anonymous bootstrap; callable login/create/join; password hashing; custom claims; token refresh.
*Done when:* claims are set correctly and rules now enforce per-identity access in tests.

**M3 — Admin authoring & status machine.** Admin home, event dashboard, round/question editors, number auto-assign, all status-transition actions + reset (with confirmation).
*Done when:* an admin can author a complete event and drive every status transition; illegal transitions are rejected.

**M4 — Grading & aggregation (F2).** Trigger function: MC auto-grade, free-text normalize+suggest, scoreboard maintenance, auto `VALIDATION→DONE`.
*Done when:* submitting answers yields correct points + scoreboard; correct answers never leave the server to a participant.

**M5 — Participant app.** All six participant screens, live via `onSnapshot`, mobile-optimized; QR create/login.
*Done when:* a phone can complete the full journey; status changes appear live; only permitted data is visible.

**M6 — Validation screen & score tables.** Flat free-text validation table; event/round score tables.
*Done when:* validating all free-text answers completes the round; tables match computed points.

**M7 — Polish, seed data, deploy.** Seed/test script, responsive pass, final rules review, production deploy to Firebase Hosting + Functions.
*Done when:* a full end-to-end quiz dry run passes on the deployed app.

---

## 10. Cross-cutting acceptance criteria

- Participant never receives a correct answer or another team's answer text over the wire (verify in network tab + rules tests).
- Answering blocked the instant a round enters `VALIDATION`/`DONE` or while a question is `INACTIVE`.
- Only the latest submission per (team, question) counts toward score.
- Admins can set arbitrary point values, including fractional (e.g. 0.5).
- All UI text German; all code English; no i18n layer.

---

## 11. Driving this with an AI coding agent

1. Have the agent **load the Firebase skills**, clone `https://github.com/bro314/soak-quiz`, and confirm access to project `soak-quiz-app` before M0.
2. Execute **one milestone per session**; run the milestone's tests before moving on (the M1 rules tests spin up a local Firestore emulator automatically).
3. Treat §4 (rules) and §6 (functions) as the security contract — never weaken a rule to make a feature work; fix the data model instead.
4. Keep the spec open alongside the **§8 Screens** section to verify each screen 1:1.

## 12. Agent Notes & Lessons Learned (from M0)

### MUI v9 Breaking Changes
- **Icon Imports**: MUI v9 uses different naming conventions for outlined variants. Icons like `CheckCircleOutline` and `ErrorOutline` are named `CheckCircleOutlineOutlined` and `ErrorOutlineOutlined`. Importing the old names results in unresolved module errors during production builds.
- **Typography API**: The `fontWeight` property is no longer accepted as a direct prop on `<Typography>` elements. Instead, pass it via the `sx` prop (e.g., `sx={{ fontWeight: 600 }}`).

### Cloud Functions Environment
- Sourcing `.bash_profile` in commands is not persistently supported by the sandbox.
- When compiling functions with TypeScript 6.0+, you **must** explicitly define `"rootDir": "src"` alongside `"outDir": "lib"` in `functions/tsconfig.json` to prevent compiling layout structure errors. Ensure the package.json `"main"` points directly to `"lib/index.js"`.

### Environment PATH
- Standard system tools (like `npm` and `gcloud`) are available in the user's homebrew/nvm/downloads folder structures. Explicitly prefix commands with `export PATH="$HOME/.nvm/versions/node/v22.20.0/bin:$HOME/Downloads/google-cloud-sdk/bin:/opt/homebrew/bin:$PATH"` if commands fail to locate `node`, `npx` or `gcloud`.

### Firestore Rules & Invariant 8 (from M1)
- **Event Creation Access**: The security rules must allow event document creation by authenticated users who do not yet have a `'team'` role claim matching that specific `eventId`. If a user is logged in as a team for `eventId`, they are strictly denied from creating or overwriting `events/{eventId}`.
- **Rules Testing**: When testing Firestore Security Rules with `@firebase/rules-unit-testing`, ensure the Firestore Emulator is running (e.g. `firebase emulators:start --only firestore`). Custom claims should be mocked in the test environment initialization (`testEnv.authenticatedContext(userId, tokenClaims)`).