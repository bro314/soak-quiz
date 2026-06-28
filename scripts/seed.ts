import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

// Password hashing helper matching functions implementation
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const eventId = "soak-test-event";
const adminPassword = "adminpassword";

// Choose project and optional emulator based on environment
const projectId = "soak-quiz-app";
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`Connecting to Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
} else {
  console.log("Connecting to live Firestore project:", projectId);
}

// Initialize Admin SDK
if (getApps().length === 0) {
  initializeApp({
    projectId: projectId,
  });
}

const db = getFirestore();

async function seed() {
  console.log("Starting database seeding...");

  const batch = db.batch();

  // 1. Create Event
  const eventRef = db.doc(`events/${eventId}`);
  batch.set(eventRef, {
    name: "SoAk Test-Event 2026",
    maxTeamSize: 6,
    status: "ACTIVE",
  });

  // 2. Create Event Secret Admin Auth
  const eventAuthRef = db.doc(`events/${eventId}/secret/auth`);
  batch.set(eventAuthRef, {
    adminPasswordHash: hashPassword(adminPassword),
  });

  // 3. Create Rounds
  const round1Id = "round-1";
  const round1Ref = db.doc(`events/${eventId}/rounds/${round1Id}`);
  batch.set(round1Ref, {
    number: 1,
    title: "Runde 1: Allgemeinwissen",
    status: "ACTIVE",
  });

  const round1DetailRef = db.doc(`events/${eventId}/rounds/${round1Id}/detail/main`);
  batch.set(round1DetailRef, {
    description: "Ein bunter Mix aus einfachen Fragen zum Aufwärmen.",
  });

  const round2Id = "round-2";
  const round2Ref = db.doc(`events/${eventId}/rounds/${round2Id}`);
  batch.set(round2Ref, {
    number: 2,
    title: "Runde 2: Natur & Wissenschaft",
    status: "INACTIVE",
  });

  const round2DetailRef = db.doc(`events/${eventId}/rounds/${round2Id}/detail/main`);
  batch.set(round2DetailRef, {
    description: "Hier wird es etwas anspruchsvoller. Natur, Physik, Chemie und Geographie.",
  });

  // 4. Create Questions for Round 1
  const q1_1Id = "q-1-1";
  const q1_1Ref = db.doc(`events/${eventId}/rounds/${round1Id}/questions/${q1_1Id}`);
  batch.set(q1_1Ref, {
    number: 1,
    type: "FREE_TEXT",
    title: "Hauptstadt von Frankreich",
    status: "ACTIVE",
  });
  batch.set(db.doc(`events/${eventId}/rounds/${round1Id}/questions/${q1_1Id}/detail/main`), {
    content: "Wie heißt die Hauptstadt von Frankreich? Bitte achte auf korrekte Rechtschreibung.",
  });
  batch.set(db.doc(`events/${eventId}/rounds/${round1Id}/questions/${q1_1Id}/secret/answer`), {
    correctAnswer: "Paris",
  });

  const q1_2Id = "q-1-2";
  const q1_2Ref = db.doc(`events/${eventId}/rounds/${round1Id}/questions/${q1_2Id}`);
  batch.set(q1_2Ref, {
    number: 2,
    type: "MULTIPLE_CHOICE",
    title: "Bundesländer in Deutschland",
    status: "ACTIVE",
  });
  batch.set(db.doc(`events/${eventId}/rounds/${round1Id}/questions/${q1_2Id}/detail/main`), {
    content: "Wie viele Bundesländer hat die Bundesrepublik Deutschland?",
    possibleAnswers: ["14", "15", "16", "17"],
  });
  batch.set(db.doc(`events/${eventId}/rounds/${round1Id}/questions/${q1_2Id}/secret/answer`), {
    correctAnswer: "16",
  });

  // 5. Create Questions for Round 2
  const q2_1Id = "q-2-1";
  const q2_1Ref = db.doc(`events/${eventId}/rounds/${round2Id}/questions/${q2_1Id}`);
  batch.set(q2_1Ref, {
    number: 1,
    type: "MULTIPLE_CHOICE",
    title: "Hauptbestandteil der Luft",
    status: "INACTIVE",
  });
  batch.set(db.doc(`events/${eventId}/rounds/${round2Id}/questions/${q2_1Id}/detail/main`), {
    content: "Welches Gas macht den größten Anteil unserer Atemluft aus?",
    possibleAnswers: ["Sauerstoff", "Stickstoff", "Kohlendioxid", "Argon"],
  });
  batch.set(db.doc(`events/${eventId}/rounds/${round2Id}/questions/${q2_1Id}/secret/answer`), {
    correctAnswer: "Stickstoff",
  });

  const q2_2Id = "q-2-2";
  const q2_2Ref = db.doc(`events/${eventId}/rounds/${round2Id}/questions/${q2_2Id}`);
  batch.set(q2_2Ref, {
    number: 2,
    type: "FREE_TEXT",
    title: "Chemisches Symbol für Gold",
    status: "INACTIVE",
  });
  batch.set(db.doc(`events/${eventId}/rounds/${round2Id}/questions/${q2_2Id}/detail/main`), {
    content: "Wie lautet das chemische Symbol für Gold?",
  });
  batch.set(db.doc(`events/${eventId}/rounds/${round2Id}/questions/${q2_2Id}/secret/answer`), {
    correctAnswer: "Au",
  });

  // 6. Create Teams
  const teams = [
    { id: "die-besserwisser", name: "Die Besserwisser", password: "besserwisser", members: "Lara, Tom, Felix", token: "token-besserwisser" },
    { id: "einstein-junior", name: "Einstein Junior", password: "einsteinjunior", members: "Marie, Max", token: "token-einstein" },
  ];

  for (const team of teams) {
    const teamRef = db.doc(`events/${eventId}/teams/${team.id}`);
    batch.set(teamRef, {
      name: team.name,
      memberNames: team.members,
      createdAt: FieldValue.serverTimestamp(),
    });

    const teamAuthRef = db.doc(`events/${eventId}/teams/${team.id}/secret/auth`);
    batch.set(teamAuthRef, {
      teamPasswordHash: hashPassword(team.password),
      joinToken: team.token,
    });

    const scoreboardRef = db.doc(`events/${eventId}/scoreboard/${team.id}`);
    batch.set(scoreboardRef, {
      perRound: {},
      total: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log("Database successfully seeded!");
  console.log(`Event ID: ${eventId}`);
  console.log(`Admin Password: ${adminPassword}`);
  console.log("Teams seeded:");
  teams.forEach((t) => {
    console.log(` - Team: "${t.name}" (ID: ${t.id}), Password: "${t.password}", Join Token: "${t.token}"`);
  });
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
