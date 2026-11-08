import type { ContactLinks } from "./contacts";
import type { QuizAnswers } from "./questions";
import type { Customisation, Pose, PlayerState, RoomSnapshot, Stage } from "./room";

export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T> = (result: AckResult<T>) => void;

export type HostSession = { code: string; hostToken: string };

export type JoinRequest = {
  code: string;
  name: string;
  /** Present when rejoining after a refresh or reconnect. */
  playerToken?: string;
};

export type JoinResult = {
  playerId: string;
  playerToken: string;
  room: RoomSnapshot;
};

/** What a student hands in at the end of the questionnaire. */
export type QuizSubmission = { answers: QuizAnswers; contacts: ContactLinks };

/** What a student sees when they click someone in their group. */
export type TeammateProfile = {
  id: string;
  /** Null if they never handed in the questionnaire. */
  answers: QuizAnswers | null;
  contacts: ContactLinks;
};

/** Why two students suit each other. "template" is a plain comparison, not written by AI. */
export type MatchSummary = { text: string; source: "gemini" | "template" };

/** Events the browser sends to the server. */
export interface ClientToServerEvents {
  "host:create": (ack: Ack<HostSession>) => void;
  "host:attach": (req: HostSession, ack: Ack<RoomSnapshot>) => void;
  "player:join": (req: JoinRequest, ack: Ack<JoinResult>) => void;
  "player:move": (pose: Pose) => void;
  /** Change your own character's colour and hat; broadcast to the whole room. */
  "player:customize": (req: Customisation, ack: Ack<null>) => void;
  /** Leave the room on purpose (vs. a dropped connection). */
  "player:leave": (ack: Ack<null>) => void;
  /** Demo mode: host adds a batch of bots that answer the quiz at random. */
  "host:addBots": (ack: Ack<null>) => void;
  /** Host moves the room from the lobby into the quiz. */
  "host:startQuiz": (ack: Ack<null>) => void;
  /** Player submits their questionnaire (once; the server builds their profile). */
  "quiz:submit": (submission: QuizSubmission, ack: Ack<null>) => void;
  /** Host closes the quiz and sorts everyone into biomes. */
  "host:sort": (ack: Ack<null>) => void;
  /** Someone in your group's answers and contact links. */
  "profile:get": (req: { id: string }, ack: Ack<TeammateProfile>) => void;
  /** Why they suit you. Can take a few seconds the first time. */
  "profile:match": (req: { id: string }, ack: Ack<MatchSummary>) => void;
}

/** Events the server pushes to everyone in a room. */
export interface ServerToClientEvents {
  "player:upsert": (player: PlayerState) => void;
  /** Player dropped their connection; they may come back. */
  "player:left": (payload: { id: string }) => void;
  /** Player left the lobby on purpose and is gone from the room. */
  "player:removed": (payload: { id: string }) => void;
  "players:moved": (moves: Array<Pose & { id: string }>) => void;
  "room:stage": (payload: { stage: Stage }) => void;
  /** Full room state, sent when many players change at once (e.g. after sorting). */
  "room:snapshot": (snapshot: RoomSnapshot) => void;
  /** This browser tab was replaced by a newer tab using the same player. */
  "session:replaced": () => void;
}
