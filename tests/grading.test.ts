import { describe, it, beforeAll, afterAll, expect } from "vitest";
import * as crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

describe("Grading & Aggregation (F2)", () => {
  let app: any;
  let auth: any;
  let db: any;
  let functions: any;
  let adminDb: any;
  let clientSignOut: any;
  let clientSignInAnonymously: any;
  let clientHttpsCallable: any;

  const projectId = "soak-quiz-app";

  beforeAll(async () => {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const { initializeApp: initializeClientApp } = await import("firebase/app");
    const { getAuth, connectAuthEmulator, signInAnonymously, signOut } = await import("firebase/auth");
    const { getFirestore: getClientFirestore, connectFirestoreEmulator } = await import("firebase/firestore");
    const { getFunctions, connectFunctionsEmulator, httpsCallable } = await import("firebase/functions");

    clientSignOut = signOut;
    clientSignInAnonymously = signInAnonymously;
    clientHttpsCallable = httpsCallable;

    if (getApps().length === 0) {
      initializeApp({
        projectId: projectId,
      });
    }
    adminDb = getFirestore();

    app = initializeClientApp({
      apiKey: "fake-api-key",
      authDomain: `${projectId}.firebaseapp.com`,
      projectId: projectId,
    });

    auth = getAuth(app);
    db = getClientFirestore(app);
    functions = getFunctions(app, "europe-west1");

    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  });


  afterAll(async () => {
    if (auth && clientSignOut) {
      await clientSignOut(auth);
    }
  });

  it("should auto-grade MC and Free-Text answers, update scoreboards, and auto-transition rounds", async () => {
    const eventId = "grade-event-" + Date.now();
    const adminPassword = "secret-admin-pass";
    const hashedAdminPassword = hashPassword(adminPassword);

    // 1. Seed Event and admin credentials
    await adminDb.doc(`events/${eventId}`).set({
      name: "Grading Test Event",
      maxTeamSize: 6,
      status: "ACTIVE",
    });
    await adminDb.doc(`events/${eventId}/secret/auth`).set({
      adminPasswordHash: hashedAdminPassword,
    });

    // 2. Create Rounds and Questions
    const roundId = "round-1";
    await adminDb.doc(`events/${eventId}/rounds/${roundId}`).set({
      number: 1,
      title: "Round 1",
      status: "ACTIVE",
    });

    const mcQuestionId = "q-mc";
    await adminDb.doc(`events/${eventId}/rounds/${roundId}/questions/${mcQuestionId}`).set({
      number: 1,
      type: "SINGLE_CHOICE",
      title: "MC Question",
      status: "ACTIVE",
    });
    await adminDb.doc(`events/${eventId}/rounds/${roundId}/questions/${mcQuestionId}/secret/answer`).set({
      correctAnswer: "B",
    });

    const multiMcQuestionId = "q-multi-mc";
    await adminDb.doc(`events/${eventId}/rounds/${roundId}/questions/${multiMcQuestionId}`).set({
      number: 2,
      type: "MULTIPLE_CHOICE",
      title: "Multi MC Question",
      status: "ACTIVE",
    });
    await adminDb.doc(`events/${eventId}/rounds/${roundId}/questions/${multiMcQuestionId}/secret/answer`).set({
      correctAnswer: "A,C",
    });

    const ftQuestionId = "q-ft";
    await adminDb.doc(`events/${eventId}/rounds/${roundId}/questions/${ftQuestionId}`).set({
      number: 3,
      type: "FREE_TEXT",
      title: "Free Text Question",
      status: "ACTIVE",
    });
    await adminDb.doc(`events/${eventId}/rounds/${roundId}/questions/${ftQuestionId}/secret/answer`).set({
      correctAnswer: "Munich",
    });

    // 3. Create a team and log in
    const userCredential = await clientSignInAnonymously(auth);
    const createTeamFn = clientHttpsCallable(functions, "createTeam");
    const createRes = await createTeamFn({
      eventId,
      name: "Test Graders",
      password: "team-password",
      memberNames: "Alice",
    });
    expect(createRes.data.status).toBe("success");
    const teamId = createRes.data.teamId;

    // Refresh claims
    await userCredential.user.getIdTokenResult(true);

    // 4. Submit correct MC Answer
    const mcAnswerRef = adminDb.doc(`events/${eventId}/answers/${teamId}__${roundId}__${mcQuestionId}`);
    await mcAnswerRef.set({
      teamId,
      roundId,
      questionId: mcQuestionId,
      answerText: "B",
      submittedAt: new Date(),
      points: 0,
      validated: false,
    });

    // Wait for trigger to complete auto-grading and updating scoreboard
    let mcAnswerData: any = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const snap = await mcAnswerRef.get();
      if (snap.data()?.validated === true) {
        mcAnswerData = snap.data();
        break;
      }
    }
    expect(mcAnswerData).toBeDefined();
    expect(mcAnswerData.points).toBe(1);

    // Verify scoreboard has 1 point for round-1
    let scoreboardSnap = await adminDb.doc(`events/${eventId}/scoreboard/${teamId}`).get();
    expect(scoreboardSnap.data()?.perRound?.[roundId]).toBe(1);
    expect(scoreboardSnap.data()?.total).toBe(1);

    // 4b. Submit correct Multi-MC Answer
    const multiMcAnswerRef = adminDb.doc(`events/${eventId}/answers/${teamId}__${roundId}__${multiMcQuestionId}`);
    await multiMcAnswerRef.set({
      teamId,
      roundId,
      questionId: multiMcQuestionId,
      answerText: "A,C",
      submittedAt: new Date(),
      points: 0,
      validated: false,
    });

    // Wait for trigger to complete auto-grading and updating scoreboard
    let multiMcAnswerData: any = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const snap = await multiMcAnswerRef.get();
      if (snap.data()?.validated === true) {
        multiMcAnswerData = snap.data();
        break;
      }
    }
    expect(multiMcAnswerData).toBeDefined();
    expect(multiMcAnswerData.points).toBe(1);

    // Verify scoreboard has 2 points now
    scoreboardSnap = await adminDb.doc(`events/${eventId}/scoreboard/${teamId}`).get();
    expect(scoreboardSnap.data()?.perRound?.[roundId]).toBe(2);
    expect(scoreboardSnap.data()?.total).toBe(2);

    // 5. Submit Free-Text Answer (with extra spaces and symbols to check normalization)
    const ftAnswerRef = adminDb.doc(`events/${eventId}/answers/${teamId}__${roundId}__${ftQuestionId}`);
    await ftAnswerRef.set({
      teamId,
      roundId,
      questionId: ftQuestionId,
      answerText: "   munich!!  ",
      submittedAt: new Date(),
      points: 0,
      validated: false,
    });

    // Wait for trigger to complete grading (validated remains false for free text, but gradedAt is set)
    let ftAnswerData: any = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const snap = await ftAnswerRef.get();
      if (snap.data()?.gradedAt !== undefined) {
        ftAnswerData = snap.data();
        break;
      }
    }
    expect(ftAnswerData).toBeDefined();
    expect(ftAnswerData.points).toBe(1); // Normalization match
    expect(ftAnswerData.validated).toBe(false); // Free text is not auto-validated

    // Scoreboard should still be 2 (since Free Text is validated: false)
    scoreboardSnap = await adminDb.doc(`events/${eventId}/scoreboard/${teamId}`).get();
    expect(scoreboardSnap.data()?.total).toBe(2);

    // 6. Transition round to VALIDATION
    await adminDb.doc(`events/${eventId}/rounds/${roundId}`).update({
      status: "VALIDATION",
    });

    // 7. Validate Free-Text answer (admin manual action)
    await ftAnswerRef.update({
      points: 1.5, // edit points slightly
      validated: true,
    });

    // Wait for scoreboard update and round status auto-transition to DONE
    let roundStatus = "";
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const rSnap = await adminDb.doc(`events/${eventId}/rounds/${roundId}`).get();
      if (rSnap.data()?.status === "DONE") {
        roundStatus = rSnap.data()?.status;
        break;
      }
    }
    expect(roundStatus).toBe("DONE");

    // Verify scoreboard includes validated free-text answer (1.5) + MC answer (1) + Multi-MC answer (1) = 3.5
    scoreboardSnap = await adminDb.doc(`events/${eventId}/scoreboard/${teamId}`).get();
    expect(scoreboardSnap.data()?.perRound?.[roundId]).toBe(3.5);
    expect(scoreboardSnap.data()?.total).toBe(3.5);
  });
});
