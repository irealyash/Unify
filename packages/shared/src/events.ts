import type { QuizAnswers } from "./questions";
import type { Pose, PlayerState, RoomSnapshot, Stage } from "./room";

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

/** Events the browser sends to the server. */
export interface ClientToServerEvents {
  "host:create": (ack: Ack<HostSession>) => void;
  "host:attach": (req: HostSession, ack: Ack<RoomSnapshot>) => void;
  "player:join": (req: JoinRequest, ack: Ack<JoinResult>) => void;
  "player:move": (pose: Pose) => void;
  /** Leave the room on purpose (vs. a dropped connection). */
  "player:leave": (ack: Ack<null>) => void;
  /** Host moves the room from the lobby into the quiz. */
  "host:startQuiz": (ack: Ack<null>) => void;
  /** Player submits their questionnaire (once; the server builds their profile). */
  "quiz:submit": (answers: QuizAnswers, ack: Ack<null>) => void;
  /** Host closes the quiz and sorts everyone into biomes. */
  "host:sort": (ack: Ack<null>) => void;
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
