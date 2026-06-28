export type EventStatus = 'INACTIVE' | 'ACTIVE';

export interface Event {
  id: string;
  name: string;
  maxTeamSize: number;
  status: EventStatus;
}

export interface EventSecretAuth {
  adminPasswordHash: string;
}

export interface Team {
  id: string;
  name: string;
  memberNames: string; // Comma-separated or free-text names
  createdAt: any; // firestore.FieldValue or Timestamp
}

export interface TeamSecretAuth {
  teamPasswordHash: string;
  joinToken: string;
}

export type RoundStatus = 'INACTIVE' | 'ACTIVE' | 'VALIDATION' | 'DONE';

export interface Round {
  id: string;
  number: number;
  title: string;
  status: RoundStatus;
}

export interface RoundDetail {
  description: string;
}

export type QuestionType = 'MULTIPLE_CHOICE' | 'FREE_TEXT';
export type QuestionStatus = 'INACTIVE' | 'ACTIVE';

export interface Question {
  id: string;
  number: number;
  type: QuestionType;
  title: string;
  status: QuestionStatus;
}

export interface QuestionDetail {
  content: string; // Description or optional content
  possibleAnswers?: string[]; // Used for Multiple Choice
}

export interface QuestionSecretAnswer {
  correctAnswer: string;
}

export interface Answer {
  id: string; // Format: teamId__questionId
  teamId: string;
  roundId: string;
  questionId: string;
  answerText: string;
  submittedAt: any; // Server timestamp
  points: number;
  validated: boolean;
  gradedAt?: any;
}

export interface Scoreboard {
  teamId: string;
  perRound: { [roundId: string]: number };
  total: number;
  updatedAt: any;
}
