import { httpsCallable } from "firebase/functions";
import { functions } from "./index";

export interface CreateTeamRequest {
  eventId: string;
  name: string;
  password?: string;
  memberNames?: string;
}

export interface CreateTeamResponse {
  status: string;
  teamId: string;
  joinToken: string;
}

export interface LoginTeamRequest {
  eventId: string;
  teamId: string;
  password?: string;
}

export interface JoinTeamByTokenRequest {
  eventId: string;
  teamId: string;
  token: string;
}

export interface LoginAdminRequest {
  eventId: string;
  password?: string;
}

export interface AuthFunctionResponse {
  status: string;
}

export const createTeamCallable = httpsCallable<CreateTeamRequest, CreateTeamResponse>(
  functions,
  "createTeam"
);

export const loginTeamCallable = httpsCallable<LoginTeamRequest, AuthFunctionResponse>(
  functions,
  "loginTeam"
);

export const joinTeamByTokenCallable = httpsCallable<JoinTeamByTokenRequest, AuthFunctionResponse>(
  functions,
  "joinTeamByToken"
);

export const loginAdminCallable = httpsCallable<LoginAdminRequest, AuthFunctionResponse>(
  functions,
  "loginAdmin"
);
