import { describe, it, beforeAll, afterAll, expect } from "vitest";
import * as crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

describe("Cloud Functions - Auth (F1)", () => {
  let app: any;
  let auth: any;
  let db: any;
  let functions: any;
  let adminDb: any;
  let clientSignOut: any;
  let clientSignInAnonymously: any;
  let clientHttpsCallable: any;
  let getDocClient: any;
  let docClient: any;

  const projectId = "soak-quiz-app";

  beforeAll(async () => {
    // 1. Force emulator environment variables
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

    // 2. Dynamically import modules to prevent Vite hoisting
    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const { initializeApp: initializeClientApp } = await import("firebase/app");
    const { getAuth, connectAuthEmulator, signInAnonymously, signOut } = await import("firebase/auth");
    const { getFirestore: getClientFirestore, connectFirestoreEmulator, getDoc, doc } = await import("firebase/firestore");
    const { getFunctions, connectFunctionsEmulator, httpsCallable } = await import("firebase/functions");

    clientSignOut = signOut;
    clientSignInAnonymously = signInAnonymously;
    clientHttpsCallable = httpsCallable;
    getDocClient = getDoc;
    docClient = doc;

    // Initialize Admin SDK connected to emulator
    if (getApps().length === 0) {
      initializeApp({
        projectId: projectId,
      });
    }
    adminDb = getFirestore();

    // Initialize Client SDK
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

  it("should perform team creation, login, token-based join, and admin login flows successfully", async () => {
    const eventId = "test-event-" + Date.now();
    const adminPassword = "secret-admin-pass";
    const hashedAdminPassword = hashPassword(adminPassword);

    // Seed the Event and Admin credentials in Firestore
    await adminDb.doc(`events/${eventId}`).set({
      name: "Test Event",
      maxTeamSize: 6,
      status: "ACTIVE",
    });

    await adminDb.doc(`events/${eventId}/secret/auth`).set({
      adminPasswordHash: hashedAdminPassword,
    });

    // Sign in client anonymously
    expect(auth).not.toBeNull();
    const userCredential = await clientSignInAnonymously(auth!);
    const uid = userCredential.user.uid;
    expect(uid).toBeDefined();

    // Call createTeam
    const createTeamFn = clientHttpsCallable(functions, "createTeam");
    const createRes = await createTeamFn({
      eventId,
      name: "Quiz Masters",
      password: "team-password",
      memberNames: "Alice, Bob",
    });

    expect(createRes.data.status).toBe("success");
    expect(createRes.data.teamId).toBe("quiz-masters");
    expect(createRes.data.joinToken).toBeDefined();

    // Verify Firestore documents were created using Admin SDK
    const teamSnap = await adminDb.doc(`events/${eventId}/teams/quiz-masters`).get();
    expect(teamSnap.exists).toBe(true);
    expect(teamSnap.data()?.name).toBe("Quiz Masters");
    expect(teamSnap.data()?.memberNames).toBe("Alice, Bob");

    const teamAuthSnap = await adminDb.doc(`events/${eventId}/teams/quiz-masters/secret/auth`).get();
    expect(teamAuthSnap.exists).toBe(true);
    expect(teamAuthSnap.data()?.joinToken).toBe(createRes.data.joinToken);

    const scoreboardSnap = await adminDb.doc(`events/${eventId}/scoreboard/quiz-masters`).get();
    expect(scoreboardSnap.exists).toBe(true);
    expect(scoreboardSnap.data()?.total).toBe(0);

    // Verify token custom claims have been applied
    let idTokenResult = await userCredential.user.getIdTokenResult(true);
    expect(idTokenResult.claims.role).toBe("team");
    expect(idTokenResult.claims.eventId).toBe(eventId);
    expect(idTokenResult.claims.teamId).toBe("quiz-masters");

    // Test Team Login with a new anonymous session
    await clientSignOut(auth!);
    const anotherUserCred = await clientSignInAnonymously(auth!);
    let anotherIdTokenResult = await anotherUserCred.user.getIdTokenResult(true);
    expect(anotherIdTokenResult.claims.role).toBeUndefined(); // new user, no claims

    const loginTeamFn = clientHttpsCallable(functions, "loginTeam");
    const loginRes = await loginTeamFn({
      eventId,
      teamId: "quiz-masters",
      password: "team-password",
    });
    expect(loginRes.data.status).toBe("success");

    anotherIdTokenResult = await anotherUserCred.user.getIdTokenResult(true);
    expect(anotherIdTokenResult.claims.role).toBe("team");
    expect(anotherIdTokenResult.claims.eventId).toBe(eventId);
    expect(anotherIdTokenResult.claims.teamId).toBe("quiz-masters");

    // Test Token-based Join with another new anonymous session
    await clientSignOut(auth!);
    const thirdUserCred = await clientSignInAnonymously(auth!);
    const joinTeamByTokenFn = clientHttpsCallable(functions, "joinTeamByToken");
    const joinRes = await joinTeamByTokenFn({
      eventId,
      teamId: "quiz-masters",
      token: createRes.data.joinToken,
    });
    expect(joinRes.data.status).toBe("success");

    let thirdIdTokenResult = await thirdUserCred.user.getIdTokenResult(true);
    expect(thirdIdTokenResult.claims.role).toBe("team");
    expect(thirdIdTokenResult.claims.eventId).toBe(eventId);
    expect(thirdIdTokenResult.claims.teamId).toBe("quiz-masters");

    // Test Admin Login with another new anonymous session
    await clientSignOut(auth!);
    const adminUserCred = await clientSignInAnonymously(auth!);
    const loginAdminFn = clientHttpsCallable(functions, "loginAdmin");
    const adminLoginRes = await loginAdminFn({
      eventId,
      password: adminPassword,
    });
    expect(adminLoginRes.data.status).toBe("success");

    let adminIdTokenResult = await adminUserCred.user.getIdTokenResult(true);
    expect(adminIdTokenResult.claims.role).toBe("admin");
    expect(adminIdTokenResult.claims.eventId).toBe(eventId);
    expect(adminIdTokenResult.claims.teamId).toBeUndefined();
  });
});
