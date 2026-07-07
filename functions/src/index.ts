import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

// Initialize Admin SDK
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Password hashing helpers
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === originalHash;
}

// Health check — verifies the functions runtime is working.
export const healthCheck = onRequest(
  { region: "europe-west1" },
  (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  }
);

// New callable: createEvent(eventId, name, maxTeamSize, adminPassword)
export const createEvent = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in anonymously first.");
  }

  const { eventId, name, maxTeamSize, adminPassword } = request.data || {};
  if (!eventId || !name || !adminPassword) {
    throw new HttpsError("invalid-argument", "Missing eventId, name, or adminPassword.");
  }

  const size = maxTeamSize ? Number(maxTeamSize) : 6;
  if (isNaN(size) || size <= 0 || size > 100) {
    throw new HttpsError("invalid-argument", "maxTeamSize must be between 1 and 100.");
  }

  const eventRef = db.doc(`events/${eventId}`);
  const authRef = db.doc(`events/${eventId}/secret/auth`);

  await db.runTransaction(async (transaction) => {
    const existingEvent = await transaction.get(eventRef);
    if (existingEvent.exists) {
      throw new HttpsError("already-exists", `Event with ID "${eventId}" already exists.`);
    }

    transaction.set(eventRef, {
      name,
      maxTeamSize: size,
      status: "INACTIVE",
    });

    transaction.set(authRef, {
      adminPasswordHash: hashPassword(adminPassword),
    });
  });

  // Set custom claim for admin of this event immediately
  await auth.setCustomUserClaims(request.auth.uid, {
    role: "admin",
    eventId,
  });

  return { status: "success" };
});

// F1: createTeam(eventId, name, password, memberNames)
export const createTeam = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in anonymously first.");
  }

  const { eventId, name, password, memberNames } = request.data || {};
  if (!eventId || !name || !password) {
    throw new HttpsError("invalid-argument", "Missing eventId, name, or password.");
  }

  // Verify that the event is ACTIVE
  const eventRef = db.doc(`events/${eventId}`);
  const eventDoc = await eventRef.get();
  if (!eventDoc.exists) {
    throw new HttpsError("not-found", "Event not found.");
  }
  const eventData = eventDoc.data();
  if (!eventData || eventData.status !== "ACTIVE") {
    throw new HttpsError("failed-precondition", "Event is not active.");
  }

  // Generate team ID from name (slugified)
  const teamId = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!teamId) {
    throw new HttpsError("invalid-argument", "Team name is invalid.");
  }

  const teamRef = db.doc(`events/${eventId}/teams/${teamId}`);
  const teamAuthRef = db.doc(`events/${eventId}/teams/${teamId}/secret/auth`);
  const scoreboardRef = db.doc(`events/${eventId}/scoreboard/${teamId}`);

  // Run as transaction to check if team exists and write docs atomically
  const joinToken = crypto.randomBytes(16).toString("hex");
  const hashedPassword = hashPassword(password);

  await db.runTransaction(async (transaction) => {
    const existingTeam = await transaction.get(teamRef);
    if (existingTeam.exists) {
      throw new HttpsError("already-exists", `Team with name "${name}" already exists.`);
    }

    transaction.set(teamRef, {
      name,
      memberNames: memberNames || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    transaction.set(teamAuthRef, {
      teamPasswordHash: hashedPassword,
      joinToken,
    });

    transaction.set(scoreboardRef, {
      perRound: {},
      total: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  // Set custom claims on user UID
  await auth.setCustomUserClaims(request.auth.uid, {
    role: "team",
    eventId,
    teamId,
  });

  return { status: "success", teamId, joinToken };
});

// F1: loginTeam(eventId, teamId, password)
export const loginTeam = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in anonymously first.");
  }

  const { eventId, teamId, password } = request.data || {};
  if (!eventId || !teamId || !password) {
    throw new HttpsError("invalid-argument", "Missing eventId, teamId, or password.");
  }

  const teamAuthRef = db.doc(`events/${eventId}/teams/${teamId}/secret/auth`);
  const authDoc = await teamAuthRef.get();
  if (!authDoc.exists) {
    throw new HttpsError("not-found", "Team auth credentials not found.");
  }

  const authData = authDoc.data();
  if (!authData || !verifyPassword(password, authData.teamPasswordHash)) {
    throw new HttpsError("permission-denied", "Incorrect password.");
  }

  // Set custom claims on user UID
  await auth.setCustomUserClaims(request.auth.uid, {
    role: "team",
    eventId,
    teamId,
  });

  return { status: "success" };
});

// F1: joinTeamByToken(eventId, teamId, token)
export const joinTeamByToken = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in anonymously first.");
  }

  const { eventId, teamId, token } = request.data || {};
  if (!eventId || !teamId || !token) {
    throw new HttpsError("invalid-argument", "Missing eventId, teamId, or token.");
  }

  const teamAuthRef = db.doc(`events/${eventId}/teams/${teamId}/secret/auth`);
  const authDoc = await teamAuthRef.get();
  if (!authDoc.exists) {
    throw new HttpsError("not-found", "Team auth credentials not found.");
  }

  const authData = authDoc.data();
  if (!authData || token !== authData.joinToken) {
    throw new HttpsError("permission-denied", "Incorrect join token.");
  }

  // Set custom claims on user UID
  await auth.setCustomUserClaims(request.auth.uid, {
    role: "team",
    eventId,
    teamId,
  });

  return { status: "success" };
});

// F1: loginAdmin(eventId, password)
export const loginAdmin = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in anonymously first.");
  }

  const { eventId, password } = request.data || {};
  if (!eventId || !password) {
    throw new HttpsError("invalid-argument", "Missing eventId or password.");
  }

  const adminAuthRef = db.doc(`events/${eventId}/secret/auth`);
  const authDoc = await adminAuthRef.get();
  if (!authDoc.exists) {
    throw new HttpsError("not-found", "Admin auth credentials not found.");
  }

  const authData = authDoc.data();
  if (!authData || !verifyPassword(password, authData.adminPasswordHash)) {
    throw new HttpsError("permission-denied", "Incorrect password.");
  }

  // Set custom claims on user UID
  await auth.setCustomUserClaims(request.auth.uid, {
    role: "admin",
    eventId,
  });

  return { status: "success" };
});

function normalizeFreeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

async function gradeAnswer(eventId: string, answerId: string, answerData: any) {
  const { roundId, questionId, answerText } = answerData;
  if (!roundId || !questionId) return;

  const questionRef = db.doc(`events/${eventId}/rounds/${roundId}/questions/${questionId}`);
  const questionSnap = await questionRef.get();
  if (!questionSnap.exists) {
    console.error(`Question events/${eventId}/rounds/${roundId}/questions/${questionId} not found.`);
    return;
  }
  const questionData = questionSnap.data();
  if (!questionData) return;

  const answerSecretRef = db.doc(`events/${eventId}/rounds/${roundId}/questions/${questionId}/secret/answer`);
  const answerSecretSnap = await answerSecretRef.get();
  if (!answerSecretSnap.exists) {
    console.error(`Secret answer for question ${questionId} not found.`);
    return;
  }
  const answerSecretData = answerSecretSnap.data();
  if (!answerSecretData) return;

  const correctAnswer = answerSecretData.correctAnswer;
  let points = 0;
  let validated = false;

  if (questionData.type === "MULTIPLE_CHOICE" || questionData.type === "SINGLE_CHOICE") {
    points = answerText === correctAnswer ? 1 : 0;
    validated = true;
  } else if (questionData.type === "FREE_TEXT") {
    const normUser = normalizeFreeText(answerText || "");
    const normCorrect = normalizeFreeText(correctAnswer || "");
    points = normUser === normCorrect ? 1 : 0;
    validated = false;
  }

  const answerRef = db.doc(`events/${eventId}/answers/${answerId}`);
  await answerRef.update({
    points,
    validated,
    gradedAt: FieldValue.serverTimestamp(),
  });
}

async function updateScoreboardAndRound(eventId: string, teamId: string, roundId: string) {
  // 1. Recalculate scoreboard for this team
  const answersRef = db.collection(`events/${eventId}/answers`);
  const teamAnswersQuery = await answersRef.where("teamId", "==", teamId).get();

  const perRound: { [roundId: string]: number } = {};
  let total = 0;

  teamAnswersQuery.forEach((doc) => {
    const data = doc.data();
    const rId = data.roundId;
    const pts = Number(data.points) || 0;
    const val = data.validated;
    if (val) {
      perRound[rId] = (perRound[rId] || 0) + pts;
      total += pts;
    }
  });

  const scoreboardRef = db.doc(`events/${eventId}/scoreboard/${teamId}`);
  await scoreboardRef.set({
    perRound,
    total,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 2. Check if we need to auto-transition the round to DONE
  const roundRef = db.doc(`events/${eventId}/rounds/${roundId}`);
  const roundSnap = await roundRef.get();
  if (roundSnap.exists) {
    const roundData = roundSnap.data();
    if (roundData && roundData.status === "VALIDATION") {
      const roundAnswersQuery = await answersRef
        .where("roundId", "==", roundId)
        .where("validated", "==", false)
        .limit(1)
        .get();

      if (roundAnswersQuery.empty) {
        await roundRef.update({
          status: "DONE",
        });
      }
    }
  }
}

export const onAnswerWritten = onDocumentWritten(
  {
    document: "events/{eventId}/answers/{answerId}",
    region: "europe-west1",
  },
  async (event) => {
    const eventId = event.params.eventId;
    const answerId = event.params.answerId;

    const beforeDoc = event.data?.before;
    const afterDoc = event.data?.after;

    if (!afterDoc || !afterDoc.exists) {
      if (beforeDoc && beforeDoc.exists) {
        const beforeData = beforeDoc.data();
        if (beforeData) {
          await updateScoreboardAndRound(eventId, beforeData.teamId, beforeData.roundId);
        }
      }
      return;
    }

    const afterData = afterDoc.data();
    if (!afterData) return;

    const beforeData = beforeDoc && beforeDoc.exists ? beforeDoc.data() : null;

    const isNewDoc = !beforeData;
    const answerTextChanged = isNewDoc || beforeData.answerText !== afterData.answerText;
    const isUngraded = !afterData.gradedAt;

    if (answerTextChanged || isUngraded) {
      await gradeAnswer(eventId, answerId, afterData);
    } else {
      const pointsChanged = beforeData && beforeData.points !== afterData.points;
      const validatedChanged = beforeData && beforeData.validated !== afterData.validated;

      if (pointsChanged || validatedChanged || isNewDoc) {
        await updateScoreboardAndRound(eventId, afterData.teamId, afterData.roundId);
      }
    }
  }
);

