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

/** Character colours, ordered around the colour wheel from red to pink. */
export const PLAYER_COLORS = [
  "#E77878",
  "#FFA860",
  "#F4D175",
  "#9BEE94",
  "#72BBA0",
  "#A6B5B3",
  "#61C2DD",
  "#7A97DC",
  "#AA6FD5",
  "#F9AFBD",
] as const;

/** Hats a player can put on their character. */
export const HATS = [
  { id: "none", label: "None" },
  { id: "headphones", label: "Headphones" },
  { id: "bow", label: "Bow" },
  { id: "propeller", label: "Propeller" },
  { id: "flower", label: "Flower" },
  { id: "party", label: "Party hat" },
  { id: "grad", label: "Grad cap" },
] as const;

export type HatId = (typeof HATS)[number]["id"];

export function isHatId(value: unknown): value is HatId {
  return HATS.some((h) => h.id === value);
}

/** Mouth shapes a player can give their character. */
export const MOUTHS = [
  { id: "smile", label: "Smile" },
  { id: "frown", label: "Frown" },
  { id: "v", label: "Little v" },
  { id: "circle", label: "Circle" },
  { id: "flat", label: "Flat" },
  { id: "cat", label: "Cat" },
] as const;

export type MouthId = (typeof MOUTHS)[number]["id"];

export function isMouthId(value: unknown): value is MouthId {
  return MOUTHS.some((m) => m.id === value);
}

export function isPlayerColor(value: unknown): value is string {
  return typeof value === "string" && (PLAYER_COLORS as readonly string[]).includes(value);
}

/** What a player may change about their own character. */
export type Customisation = {
  color: string;
  hat: HatId;
  mouth: MouthId;
};

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
  hat: HatId;
  mouth: MouthId;
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
