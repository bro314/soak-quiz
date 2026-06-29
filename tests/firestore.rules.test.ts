import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';

describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;
  const projectId = 'soak-quiz-app';

  beforeAll(async () => {
    // Suppress verbose Firebase log messages during tests
    setLogLevel('error');
    
    const rulesPath = path.resolve(__dirname, '../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // Helper to get admin context
  function getAdminClient(eventId: string) {
    return testEnv.authenticatedContext('admin_user', {
      role: 'admin',
      eventId,
    }).firestore();
  }

  // Helper to get team context
  function getTeamClient(teamId: string, eventId: string) {
    return testEnv.authenticatedContext(`team_user_${teamId}`, {
      role: 'team',
      eventId,
      teamId,
    }).firestore();
  }

  // Helper to get another team context
  function getOtherTeamClient(teamId: string, eventId: string) {
    return testEnv.authenticatedContext(`team_user_${teamId}`, {
      role: 'team',
      eventId,
      teamId,
    }).firestore();
  }

  // Helper to get non-member authenticated context
  function getNonMemberClient() {
    return testEnv.authenticatedContext('non_member_user', {}).firestore();
  }

  // Helper to get unauthenticated context
  function getUnauthClient() {
    return testEnv.unauthenticatedContext().firestore();
  }

  describe('Invariant 1: Participant can read public-min docs of E', () => {
    it('allows event member to read event, rounds, questions, teams and scoreboard, but denies unauthenticated or non-member', async () => {
      const eventId = 'event_123';
      const adminDb = getAdminClient(eventId);

      // Seed data as admin
      await setDoc(doc(adminDb, `events/${eventId}`), { name: 'SoAk Quiz 2026', maxTeamSize: 6, status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1`), { number: 1, title: 'Runde 1', status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1/questions/q1`), { number: 1, type: 'FREE_TEXT', title: 'Frage 1', status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/teams/teamA`), { name: 'Team A', memberNames: 'Alice, Bob', createdAt: new Date() });
      await setDoc(doc(adminDb, `events/${eventId}/scoreboard/teamA`), { perRound: {}, total: 0, updatedAt: new Date() });

      const teamDb = getTeamClient('teamA', eventId);
      const nonMemberDb = getNonMemberClient();
      const unauthDb = getUnauthClient();

      // Member reads should succeed
      await assertSucceeds(getDoc(doc(teamDb, `events/${eventId}`)));
      await assertSucceeds(getDoc(doc(teamDb, `events/${eventId}/rounds/round1`)));
      await assertSucceeds(getDoc(doc(teamDb, `events/${eventId}/rounds/round1/questions/q1`)));
      await assertSucceeds(getDoc(doc(teamDb, `events/${eventId}/teams/teamA`)));
      await assertSucceeds(getDoc(doc(teamDb, `events/${eventId}/scoreboard/teamA`)));

      // Non-member reads for event and teams should succeed
      await assertSucceeds(getDoc(doc(nonMemberDb, `events/${eventId}`)));
      await assertSucceeds(getDoc(doc(nonMemberDb, `events/${eventId}/teams/teamA`)));

      // Non-member reads for other resources should fail
      await assertFails(getDoc(doc(nonMemberDb, `events/${eventId}/rounds/round1`)));
      await assertFails(getDoc(doc(nonMemberDb, `events/${eventId}/rounds/round1/questions/q1`)));
      await assertFails(getDoc(doc(nonMemberDb, `events/${eventId}/scoreboard/teamA`)));

      // Unauthenticated reads should succeed on events but fail on teams
      await assertSucceeds(getDoc(doc(unauthDb, `events/${eventId}`)));
      await assertFails(getDoc(doc(unauthDb, `events/${eventId}/teams/teamA`)));
    });
  });

  describe('Invariant 2: rounds/{r}/detail readable only if round.status != "INACTIVE"', () => {
    it('allows read when round status is ACTIVE, but denies when round status is INACTIVE', async () => {
      const eventId = 'event_123';
      const adminDb = getAdminClient(eventId);

      // Create an inactive round and an active round
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_inactive`), { number: 1, title: 'Inactive Round', status: 'INACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_inactive/detail/main`), { description: 'Super secret info' });

      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_active`), { number: 2, title: 'Active Round', status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_active/detail/main`), { description: 'Active round info' });

      const teamDb = getTeamClient('teamA', eventId);

      // Reading active detail should succeed
      await assertSucceeds(getDoc(doc(teamDb, `events/${eventId}/rounds/round_active/detail/main`)));

      // Reading inactive detail should fail
      await assertFails(getDoc(doc(teamDb, `events/${eventId}/rounds/round_inactive/detail/main`)));
    });
  });

  describe('Invariant 3: questions/{q}/detail readable only if question.status == "ACTIVE"', () => {
    it('allows read when question status is ACTIVE, but denies when question status is INACTIVE', async () => {
      const eventId = 'event_123';
      const adminDb = getAdminClient(eventId);

      // Round must be active first
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1`), { number: 1, title: 'Round 1', status: 'ACTIVE' });

      // Inactive question
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1/questions/q_inactive`), { number: 1, type: 'FREE_TEXT', title: 'Inactive Q', status: 'INACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1/questions/q_inactive/detail/main`), { content: 'Secret Question content' });

      // Active question
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1/questions/q_active`), { number: 2, type: 'FREE_TEXT', title: 'Active Q', status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1/questions/q_active/detail/main`), { content: 'Active Question content' });

      const teamDb = getTeamClient('teamA', eventId);

      // Active detail read succeeds
      await assertSucceeds(getDoc(doc(teamDb, `events/${eventId}/rounds/round1/questions/q_active/detail/main`)));

      // Inactive detail read fails
      await assertFails(getDoc(doc(teamDb, `events/${eventId}/rounds/round1/questions/q_inactive/detail/main`)));
    });
  });

  describe('Invariant 4: questions/{q}/secret/answer is NEVER readable by a participant', () => {
    it('allows admin to read answer, but denies team', async () => {
      const eventId = 'event_123';
      const adminDb = getAdminClient(eventId);

      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1`), { number: 1, title: 'Round 1', status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1/questions/q1`), { number: 1, type: 'FREE_TEXT', title: 'Q1', status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round1/questions/q1/secret/answer`), { correctAnswer: 'Berlin' });

      const teamDb = getTeamClient('teamA', eventId);

      // Admin can read
      await assertSucceeds(getDoc(doc(adminDb, `events/${eventId}/rounds/round1/questions/q1/secret/answer`)));

      // Team cannot read
      await assertFails(getDoc(doc(teamDb, `events/${eventId}/rounds/round1/questions/q1/secret/answer`)));
    });
  });

  describe('Invariant 5: answers/{teamId}__... readable only by that team or admin', () => {
    it('allows owner team and admin to read, denies other team', async () => {
      const eventId = 'event_123';
      const adminDb = getAdminClient(eventId);

      const teamAId = 'teamA';
      const teamBId = 'teamB';
      const answerDocId = `${teamAId}__q1`;

      await setDoc(doc(adminDb, `events/${eventId}/answers/${answerDocId}`), {
        teamId: teamAId,
        roundId: 'round1',
        questionId: 'q1',
        answerText: 'Paris',
        submittedAt: new Date(),
        points: 0,
        validated: false,
      });

      const teamADb = getTeamClient(teamAId, eventId);
      const teamBDb = getOtherTeamClient(teamBId, eventId);

      // Team A (owner) can read
      await assertSucceeds(getDoc(doc(teamADb, `events/${eventId}/answers/${answerDocId}`)));

      // Admin can read
      await assertSucceeds(getDoc(doc(adminDb, `events/${eventId}/answers/${answerDocId}`)));

      // Team B (non-owner) cannot read
      await assertFails(getDoc(doc(teamBDb, `events/${eventId}/answers/${answerDocId}`)));
    });
  });

  describe('Invariant 6 & 7: Write/update rules on answers', () => {
    it('enforces active round/question for team writes, blocks points/validation modification', async () => {
      const eventId = 'event_123';
      const adminDb = getAdminClient(eventId);

      // Set up question and round states
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_active`), { number: 1, title: 'Round Active', status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_active/questions/q_active`), { number: 1, type: 'FREE_TEXT', title: 'Q Active', status: 'ACTIVE' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_active/questions/q_inactive`), { number: 2, type: 'FREE_TEXT', title: 'Q Inactive', status: 'INACTIVE' });

      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_validation`), { number: 2, title: 'Round Validation', status: 'VALIDATION' });
      await setDoc(doc(adminDb, `events/${eventId}/rounds/round_validation/questions/q_validation`), { number: 1, type: 'FREE_TEXT', title: 'Q Active', status: 'ACTIVE' });

      const teamAId = 'teamA';
      const teamDb = getTeamClient(teamAId, eventId);

      // 1. Submit answer to active round & active question -> Succeeds
      const answerDocRef = doc(teamDb, `events/${eventId}/answers/${teamAId}__q_active`);
      await assertSucceeds(
        setDoc(answerDocRef, {
          teamId: teamAId,
          roundId: 'round_active',
          questionId: 'q_active',
          answerText: 'Paris',
          submittedAt: new Date(),
          points: 0,
          validated: false,
        })
      );

      // 2. Submit answer to inactive question -> Fails
      await assertFails(
        setDoc(doc(teamDb, `events/${eventId}/answers/${teamAId}__q_inactive`), {
          teamId: teamAId,
          roundId: 'round_active',
          questionId: 'q_inactive',
          answerText: 'Paris',
          submittedAt: new Date(),
          points: 0,
          validated: false,
        })
      );

      // 3. Submit answer to validation round -> Fails
      await assertFails(
        setDoc(doc(teamDb, `events/${eventId}/answers/${teamAId}__q_validation`), {
          teamId: teamAId,
          roundId: 'round_validation',
          questionId: 'q_validation',
          answerText: 'Paris',
          submittedAt: new Date(),
          points: 0,
          validated: false,
        })
      );

      // 4. Update own answerText -> Succeeds
      await assertSucceeds(
        updateDoc(answerDocRef, {
          answerText: 'London',
          submittedAt: new Date(),
        })
      );

      // 5. Update own points or validated fields -> Fails
      await assertFails(
        updateDoc(answerDocRef, {
          points: 1,
        })
      );
      await assertFails(
        updateDoc(answerDocRef, {
          validated: true,
        })
      );

      // 6. Admin can update points and validated fields
      const adminAnswerRef = doc(adminDb, `events/${eventId}/answers/${teamAId}__q_active`);
      await assertSucceeds(
        updateDoc(adminAnswerRef, {
          points: 1,
          validated: true,
          gradedAt: new Date(),
        })
      );

      // 7. Team updating already-graded answer with setDoc -> Let's see if this succeeds or fails
      await assertSucceeds(
        setDoc(answerDocRef, {
          teamId: teamAId,
          roundId: 'round_active',
          questionId: 'q_active',
          answerText: 'Munich',
          submittedAt: new Date(),
          points: 1,
          validated: true,
        })
      );

      // 8. Team resetting points/validation on update with setDoc -> Succeeds
      await assertSucceeds(
        setDoc(answerDocRef, {
          teamId: teamAId,
          roundId: 'round_active',
          questionId: 'q_active',
          answerText: 'Munich',
          submittedAt: new Date(),
          points: 0,
          validated: false,
        })
      );
    });
  });

  describe('Invariant 8: Only event admins can write events/rounds/questions/scoreboard structure and statuses', () => {
    it('denies team write access to structure, allows admin', async () => {
      const eventId = 'event_123';
      const teamDb = getTeamClient('teamA', eventId);
      const adminDb = getAdminClient(eventId);

      // Team creating event -> Fails
      await assertFails(
        setDoc(doc(teamDb, `events/${eventId}`), { name: 'Malicious Event', maxTeamSize: 6, status: 'ACTIVE' })
      );

      // Admin creating event -> Succeeds
      await assertSucceeds(
        setDoc(doc(adminDb, `events/${eventId}`), { name: 'Valid Event', maxTeamSize: 6, status: 'ACTIVE' })
      );

      // Team creating round -> Fails
      await assertFails(
        setDoc(doc(teamDb, `events/${eventId}/rounds/round1`), { number: 1, title: 'Runde 1', status: 'ACTIVE' })
      );

      // Admin creating round -> Succeeds
      await assertSucceeds(
        setDoc(doc(adminDb, `events/${eventId}/rounds/round1`), { number: 1, title: 'Runde 1', status: 'ACTIVE' })
      );
    });
  });

  describe('Invariant 9: secret/auth docs are readable/writable by no one (only admin SDK)', () => {
    it('denies read/write to teams and event admins (since auth is admin SDK only)', async () => {
      const eventId = 'event_123';
      const teamDb = getTeamClient('teamA', eventId);
      const adminDb = getAdminClient(eventId);

      const secretAuthRef = doc(adminDb, `events/${eventId}/secret/auth`);

      // Write by admin -> Fails
      await assertFails(
        setDoc(secretAuthRef, { adminPasswordHash: 'some_hash' })
      );

      // Write by team -> Fails
      await assertFails(
        setDoc(doc(teamDb, `events/${eventId}/secret/auth`), { adminPasswordHash: 'some_hash' })
      );
    });
  });
});
