import { randomUUID } from "node:crypto";
import {
  LOBBY_HALF_SIZE,
  PLAYER_COLORS,
  generateRoomCode,
  type PlayerState,
  type QuizAnswers,
  type RoomSnapshot,
  type Stage,
} from "@unify/shared";
import type { Profile } from "./ai/profile";

export type Player = PlayerState & {
  token: string;
  /** Socket currently driving this player, or null while disconnected. */
  socketId: string | null;
  answers?: QuizAnswers;
  profile?: Profile;
  /** Unit-length self vector built from the profile. */
  embedding?: number[];
};

export type Room = {
  /** Unique per room ever created (codes can be reused later); used as the DB key. */
  id: string;
  code: string;
  hostToken: string;
  stage: Stage;
  players: Map<string, Player>;
  /** Players whose pose changed since the last network tick. */
  dirty: Set<string>;
  createdAt: number;
  lastActiveAt: number;
};

/** In-memory source of truth for live rooms. Durable copies are written by ./db. */
export class RoomStore {
  private rooms = new Map<string, Room>();

  create(): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const now = Date.now();
    const room: Room = {
      id: randomUUID(),
      code,
      hostToken: randomUUID(),
      stage: "lobby",
      players: new Map(),
      dirty: new Set(),
      createdAt: now,
      lastActiveAt: now,
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code: string) {
    return this.rooms.get(code);
  }

  all() {
    return this.rooms.values();
  }

  delete(code: string) {
    this.rooms.delete(code);
  }

  findPlayerByToken(room: Room, token: string) {
    for (const player of room.players.values()) {
      if (player.token === token) return player;
    }
    return undefined;
  }

  addPlayer(room: Room, name: string): Player {
    const player: Player = {
      id: randomUUID(),
      token: randomUUID(),
      name,
      color: PLAYER_COLORS[room.players.size % PLAYER_COLORS.length]!,
      ...spawnPose(),
      connected: false,
      quiz: "answering",
      placement: null,
      socketId: null,
    };
    room.players.set(player.id, player);
    return player;
  }
}

function spawnPose() {
  const spread = LOBBY_HALF_SIZE * 0.4;
  return {
    x: (Math.random() * 2 - 1) * spread,
    z: (Math.random() * 2 - 1) * spread,
    rotY: Math.random() * Math.PI * 2,
  };
}

export function toPublicPlayer(player: Player): PlayerState {
  const { id, name, color, x, z, rotY, connected, quiz, placement } = player;
  return { id, name, color, x, z, rotY, connected, quiz, placement };
}

export function toSnapshot(room: Room): RoomSnapshot {
  return {
    code: room.code,
    stage: room.stage,
    players: [...room.players.values()].map(toPublicPlayer),
  };
}
