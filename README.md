# SoAk Quiz App

A real-time, serverless quiz application built for live event hosting.

🚀 **Live Application**: [soak-quiz-app.web.app](https://soak-quiz-app.web.app)

The application uses **React + TypeScript + Vite** for the frontend, styled with **MUI (Material UI) v9**, and relies on **Firebase (Auth, Firestore, Cloud Functions, Hosting)** for real-time reactivity and backend logic.

---

## 🌍 Language & Code Constraints

- **German UI**: All user-facing UI text and messages must be in **German** (Deutsch).
- **English Code**: All codebase components, filenames, function names, identifiers, Firestore fields, and comments must be written in **English**. No internationalization (i18n) framework is used.

---

## 🛠 Tech Stack & Architecture

- **Frontend**: Single-Page App (SPA) built with React 19, TypeScript, and Vite. Responsive design with a mobile-first approach for participants and a laptop-first layout for the admin panel.
- **Authentication**: Firebase Anonymous Auth upgraded server-side with Custom Claims (`{ role: 'admin' | 'team', eventId, teamId }`) to secure requests.
- **Database**: Cloud Firestore. Real-time updates are pushed to clients using `onSnapshot` subscriptions.
- **Security Rules**: Deny-by-default structure. Answer secrecy is strictly enforced at the Firestore document level so that correct answers and other teams' answers can never be read from the client.
- **Backend / Serverless**: Firebase Cloud Functions (2nd Gen) in `europe-west1` for secure operations (team creation, password checking, auto-grading, and scoreboard aggregation).

---

## 👥 User Roles & Workflows

### 👑 Admin Workflow
1. **Access Control**: Log in using the event's admin password.
2. **Authoring**: Create and edit Events, Rounds (auto-assigned numbers), and Questions.
3. **Question Types**:
   - *Multiple Choice*: Standard choices with a single correct answer.
   - *Free Text*: Evaluated via auto-grading suggestions, then finalized by the admin.
4. **Live Controls**: Control the game progress in real-time (start event, start next round, open next question, close round).
5. **Grading & Validation**: Close a round to put it into the `VALIDATION` state, then check the validation screen to approve or override free-text answers. Once all free-text answers are validated, the round transitions to `DONE` and updates the scoreboard.
6. **Scoreboards**: Track overall event statistics and round performance dynamically.

### 👥 Participant (Team) Workflow
1. **Joining**: Scan the room QR code or go to the event URL carrying the `eventId`.
2. **Team Registration**: Create a new team with a password and team member list, or log in to an existing team.
3. **Co-Op Join**: Share the join QR code (containing a secure `joinToken`) with team members to let them log in instantly without typing the team password.
4. **Gameplay**: Subscribed to real-time events. Questions unlock dynamically as the admin acts. Teams submit answers; only the latest answer counts.
5. **Rankings**: View team placement ("Platz X von Y") and the live public scoreboard.

---

## 📁 Repository Structure

```
├── firebase.json                 # Firebase service configuration
├── firestore.rules               # Firestore security rules
├── firestore.indexes.json        # Database indexes
├── src/                          # React Frontend App
│   ├── firebase/                 # Client SDK init and Callable wrappers
│   ├── types/                    # Shared TypeScript typings
│   ├── hooks/                    # Firestore onSnapshot and claims hooks
│   ├── routes/                   # Routing configuration (Admin + Team routes)
│   ├── participant/              # Mobile-first team screens
│   ├── admin/                    # Laptop-first admin dashboards
│   └── components/               # Shared UI elements (Score tables, status chips)
├── functions/                    # Cloud Functions (Node.js 22, TS)
│   ├── src/index.ts              # Core backend API and triggers
│   └── tsconfig.json             # Function TS configuration
├── scripts/
│   └── seed.ts                   # Database seeding script for local/live testing
└── tests/                        # Integration and Unit Tests
    ├── firestore.rules.test.ts   # Security rules test suite
    ├── functions.test.ts         # Callable functions tests
    └── grading.test.ts           # Auto-grader and trigger tests
```

---

## 💻 Local Development

### 1. Prerequisites
Ensure you have the following installed:
- Node.js (v22 recommended)
- Firebase CLI (`npm install -g firebase-tools`)

### 2. Installation
Install dependencies in the root directory and the functions folder:
```bash
npm install
npm --prefix functions install
```

### 3. Running Firebase Emulators
The emulators emulate Auth, Firestore, and Cloud Functions locally.
```bash
firebase emulators:start
```

### 4. Running the Frontend
Start the Vite development server connected to local emulators:
```bash
VITE_USE_EMULATORS=true npm run dev
```

### 5. Seeding the Database
To populate the database with a test event (`soak-test-event`), admin password (`adminpassword`), and two team accounts:
```bash
# Seed the local Emulator:
FIRESTORE_EMULATOR_HOST="127.0.0.1:8080" npm run db:seed

# Seed the live Firebase project:
npm run db:seed
```

---

## 🧪 Testing

The test suite validates security rules, database triggers, callable authentication methods, and complete end-to-end browser flows.

```bash
# Run both rules and Playwright E2E tests:
npm test

# Run unit and integration tests against local emulators only:
npm run test:rules

# Run Playwright End-to-End (E2E) browser tests only:
npx playwright test
```

> [!NOTE]
> - **Vitest Integration Tests**: Since rules tests frequently clear database states, tests must be run sequentially. Vitest is configured to run tests with `--fileParallelism=false` in the script wrapper to prevent test collisions.
> - **Playwright E2E Tests**: Playwright runs a complete, multi-user simulation (Admin creating event/rounds/questions, Team A and Team B registering, answering questions, Admin validating, and scoreboard updating). Playwright's `webServer` automatically starts the Vite app and Firebase Emulators.

---

## 🚀 Deployment

Build the client package:
```bash
npm run build
```

Deploy services to Firebase:
```bash
# Deploy all assets (Firestore rules, indexes, Functions, Hosting)
npx -y firebase-tools deploy

# Deploy individual services using firebase-tools
npx -y firebase-tools deploy --only hosting
npx -y firebase-tools deploy --only functions
npx -y firebase-tools deploy --only firestore:rules
```

---

## 🤖 Agent Guide & Implementation Notes

For AI coding agents modifying or adding features:

### 🐙 GitHub CLI Interaction (gh)
- **Interaction Tooling**: Agents interact with GitHub issues (reading content, adding comments, changing statuses) using the standard `gh` CLI.
- **Prerequisites**: Ensure `gh` is installed (`brew install gh`) and authenticated via `gh auth login` with appropriate scopes before attempting issue operations.

### 🔒 Security & Rules Invariants
- **Answer Secrecy**: Correct answers must never be accessible on the client side. Keep correct answers under `/secret/answer` path and ensure read access is restricted to `admin` role custom claims only.
- **Write Limits**: Teams must never write to scoreboard documents, modify `validated` or `points` on answers, or overwrite documents outside their owned `teamId`.
- **Rules Null Safety**: When client-side `onSnapshot` queries listen to non-existent documents (e.g. before answers are submitted), Firestore rules must use `resource == null || ...` safe guards to avoid null pointer exceptions (`Null value error`) that crash snapshot listeners.
- **Metadata/Grading Fields Update**: When teams resubmit/update their answers, client payloads must always set grading fields (`points: 0` and `validated: false`) rather than forwarding previous graded values. This prevents race conditions where the client sends stale values that mismatch the server's graded values, which security rules reject.

### ⚡ MUI v9 Specifics
- **Icon Suffixes**: MUI v9 uses `Outlined` suffix in imports rather than base names for outlines. For example, use `CheckCircleOutlineOutlined` and `ErrorOutlineOutlined`. Importing legacy names will break the production bundler.
- **Typography properties**: Do not write `<Typography fontWeight={600}>`. Use `sx={{ fontWeight: 600 }}` instead.

### 🧪 Vitest & Emulator Workarounds
- **ESM Import Hoisting**: Vitest hosts import statements at the top of test files, executing them before inline environment variables (like `process.env.FIRESTORE_EMULATOR_HOST`) are set. Ensure dynamic `await import(...)` is used within `beforeAll()` blocks for SDK initialization in tests.
- **Auth User Cache**: Client-side Firebase Auth persists active anonymous user sessions. Explicitly call `signOut(auth)` first in integration tests representing multiple new team logins.

### 🌐 Playwright E2E Gotchas & Invariants
- **Vite Watch Ignored Paths**: Playwright writes test trace/results to `test-results/`. Vite is configured in [vite.config.ts](file:///Users/brohlfs/git/soak-quiz/vite.config.ts) and `.gitignore` to ignore this directory, preventing hot module replacement (HMR) reloads from clearing frontend React states during E2E runs.
- **Typing Input Race Conditions**: Awaiting visibility of a new document in the UI is not enough if local form states are cleared asynchronously (e.g., `setRoundTitle("")`). Ensure you await the input to be cleared (`await expect(input).toHaveValue('')`) before typing the next round or question name to avoid concurrent state-update race conditions.
- **Workflow State Consistency**: For multi-user workflows that verify aggregate scoreboard stats at the end of the test, any intermediate verification actions (such as resubmitting incorrect answers or testing bounds) must be reverted or cleaned up before advancing rounds to maintain final assertions.
