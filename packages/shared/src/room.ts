import { biomeArea, type Area, type Placement } from "./biomes";

/** Stages the server moves a whole room through, in order. */
export const STAGES = ["lobby", "quiz", "sorting", "biomes"] as const;
export type Stage = (typeof STAGES)[number];

/** Half-width of the square lobby floor players can walk on (world units). */
export const LOBBY_HALF_SIZE = 14;
/** Player walk speed in world units per second. */
export const MOVE_SPEED = 6;
/** How often clients send, and the server broadcasts, positions (per second). */
export const NETWORK_TICK_HZ = 15;

export const MAX_NAME_LENGTH = 32;
export const MAX_PLAYERS_PER_ROOM = 120;

export const PLAYER_COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#2dd4bf",
  "#38bdf8",
  "#818cf8",
  "#c084fc",
  "#f472b6",
  "#a3e635",
] as const;

export type Pose = {
  x: number;
  z: number;
  /** Facing angle around the Y axis, in radians. */
  rotY: number;
};

/**
 * Where a player is in the questionnaire:
 * answering → processing (Gemini is writing their profile) → ready, or error if that failed.
 */
export type QuizStatus = "answering" | "processing" | "ready" | "error";

export type PlayerState = Pose & {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  quiz: QuizStatus;
  /** Set once the room has been sorted. */
  placement: Placement | null;
};

/** Stages in which a brand-new player may still join a room. */
export const JOINABLE_STAGES: readonly Stage[] = ["lobby", "quiz"];
/** Stages in which players can walk around (the lobby, then their biome). */
export const WALKABLE_STAGES: readonly Stage[] = ["lobby", "quiz", "biomes"];

export type RoomSnapshot = {
  code: string;
  stage: Stage;
  players: PlayerState[];
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode() {
  let out = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeRoomCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export const LOBBY_AREA: Area = { cx: 0, cz: 0, half: LOBBY_HALF_SIZE };

/** Where a player is allowed to walk: the lobby, or their biome once sorted. */
export function playerArea(stage: Stage, placement: Placement | null): Area {
  return stage === "biomes" && placement ? biomeArea(placement.biome) : LOBBY_AREA;
}
