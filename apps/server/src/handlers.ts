import type { Server, Socket } from "socket.io";
import { z } from "zod";
import {
  JOINABLE_STAGES,
  MAX_NAME_LENGTH,
  MAX_PLAYERS_PER_ROOM,
  WALKABLE_STAGES,
  biomeArea,
  clampToArea,
  TEST_MODE_TOKEN,
  normalizeContacts,
  isHatId,
  isMouthId,
  isPlayerColor,
  normalizeRoomCode,
  playerArea,
  spawnOffset,
  validateAnswers,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@unify/shared";
import { getBiomeVectors, type BiomeVectors } from "./ai/biomes";
import { errorMessage, geminiLimit, withRetry } from "./ai/gemini";
import { chooseBiome } from "./ai/sorter";
import { type AuthUser, isAuth0Configured, upsertUser, verifyIdToken } from "./auth";
import { persist } from "./db";
import { matchSummary } from "./match";
import { buildProfile } from "./quiz";
import { sortStudents, type SortCandidate, type SortResult } from "./sort";
import { RoomStore, toPublicPlayer, toSnapshot, type Player, type Room } from "./rooms";

export type SocketData = {
  role?: "host" | "player";
  code?: string;
  playerId?: string;
  user?: AuthUser;
};

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const channel = (code: string) => `room:${code}`;

const hostAttachSchema = z.object({
  code: z.string().min(1).max(16),
  hostToken: z.string().min(1).max(64),
});

const joinSchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().trim().min(1, "Enter your name").max(MAX_NAME_LENGTH),
  playerToken: z.string().max(64).optional(),
});

const poseSchema = z.object({
  x: z.number().finite(),
  z: z.number().finite(),
  rotY: z.number().finite(),
});

const submissionSchema = z.object({
  answers: z.record(z.string().max(32), z.string().max(1000)),
  contacts: z
    .object({
      email: z.string().max(300).optional(),
      discord: z.string().max(300).optional(),
      instagram: z.string().max(300).optional(),
      linkedin: z.string().max(300).optional(),
    })
    .default({}),
});

const profileRequestSchema = z.object({ id: z.string().min(1).max(64) });

function failureMessage(err: unknown) {
  return err instanceof z.ZodError
    ? (err.issues[0]?.message ?? "Invalid request")
    : err instanceof Error
      ? err.message
      : "Something went wrong";
}

/** Wraps a handler so thrown errors become `{ ok: false }` acks instead of crashing. */
function guard<T>(ack: unknown, run: () => T) {
  const reply = typeof ack === "function" ? (ack as Ack<T>) : () => {};
  try {
    reply({ ok: true, data: run() });
  } catch (err) {
    reply({ ok: false, error: failureMessage(err) });
  }
}

/** `guard` for handlers that have to wait on something before replying. */
async function guardAsync<T>(ack: unknown, run: () => Promise<T>) {
  const reply = typeof ack === "function" ? (ack as Ack<T>) : () => {};
  try {
    reply({ ok: true, data: await run() });
  } catch (err) {
    reply({ ok: false, error: failureMessage(err) });
  }
}

function requireSignedIn(socket: AppSocket) {
  if (!isAuth0Configured()) return;
  if (!socket.data.user) throw new Error("Sign in with Google to continue");
}

/** Lets people skip sign-in. Only `npm run dev` passes this flag, never `npm start`. */
const TEST_MODE_ALLOWED = process.argv.includes("--allow-test-mode");

export function registerHandlers(io: IO, store: RoomStore) {
  const broadcastPlayer = (room: Room, player: Player) =>
    io.to(channel(room.code)).emit("player:upsert", toPublicPlayer(player));

  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (token === TEST_MODE_TOKEN && TEST_MODE_ALLOWED) {
      socket.data.user = { sub: "test-mode", email: null, name: "Test mode", picture: null };
      next();
      return;
    }
    if (typeof token === "string" && token.length > 0 && isAuth0Configured()) {
      try {
        const user = await verifyIdToken(token);
        socket.data.user = user;
        void upsertUser(user).catch((err: unknown) => {
          console.error("[auth] upsert failed:", err instanceof Error ? err.message : err);
        });
      } catch (err) {
        console.warn("[auth] invalid socket token:", err instanceof Error ? err.message : err);
      }
    }
    next();
  });

  io.on("connection", (socket: AppSocket) => {
    /** The room this socket hosts, or throws. */
    const hostedRoom = () => {
      const { role, code } = socket.data;
      const room = code ? store.get(code) : undefined;
      if (role !== "host" || !room) throw new Error("Only the host can do that");
      return room;
    };

    /** The room and player this socket controls, or throws. */
    const ownPlayer = () => {
      const { role, code, playerId } = socket.data;
      const room = code ? store.get(code) : undefined;
      const player = playerId ? room?.players.get(playerId) : undefined;
      if (role !== "player" || !room || !player || player.socketId !== socket.id) {
        throw new Error("You're not in a room. Rejoin with the code.");
      }
      return { room, player };
    };

    /** Someone in this player's biome, or throws: profiles are only for your own group. */
    const groupMember = (raw: unknown) => {
      const { id } = profileRequestSchema.parse(raw);
      const { room, player } = ownPlayer();
      const target = room.players.get(id);
      if (
        room.stage !== "biomes" ||
        !player.placement ||
        !target ||
        target.id === player.id ||
        target.placement?.biome !== player.placement.biome
      ) {
        throw new Error("You can only view people in your group");
      }
      return { room, player, target };
    };

    socket.on("host:create", (ack) =>
      void guardAsync(ack, async () => {
        requireSignedIn(socket);
        const room = store.create();
        attach(socket, room, "host");
        persist.room(room);
        console.log(`[room ${room.code}] created by ${socket.data.user?.email ?? "host"}`);
        return { code: room.code, hostToken: room.hostToken };
      }),
    );

    socket.on("host:startQuiz", (ack) =>
      guard(ack, () => {
        const room = hostedRoom();
        if (room.stage !== "lobby") throw new Error("The quiz has already started");
        const connected = [...room.players.values()].filter((p) => p.connected).length;
        if (connected === 0) throw new Error("Wait for at least one person to join");
        room.stage = "quiz";
        room.lastActiveAt = Date.now();
        persist.room(room);
        io.to(channel(room.code)).emit("room:stage", { stage: room.stage });
        console.log(`[room ${room.code}] quiz started with ${connected} players`);
        return null;
      }),
    );

    socket.on("host:sort", (ack) =>
      guard(ack, () => {
        const room = hostedRoom();
        if (room.stage === "lobby") throw new Error("Start the quiz first");
        if (room.stage !== "quiz") throw new Error("This room has already been sorted");
        const submitted = [...room.players.values()].filter((p) => p.answers).length;
        if (submitted === 0) throw new Error("Nobody has submitted answers yet");

        room.stage = "sorting";
        room.lastActiveAt = Date.now();
        persist.room(room);
        io.to(channel(room.code)).emit("room:stage", { stage: room.stage });
        console.log(`[room ${room.code}] sorting ${room.players.size} players`);
        void runSort(io, room);
        return null;
      }),
    );

    socket.on("quiz:submit", (raw, ack) =>
      guard(ack, () => {
        const { room, player } = ownPlayer();
        if (room.stage !== "quiz") throw new Error("The quiz isn't open right now");
        if (player.quiz === "processing" || player.quiz === "ready") {
          throw new Error("You've already submitted your answers");
        }
        const { answers, contacts } = submissionSchema.parse(raw);
        const problem = validateAnswers(answers);
        if (problem) throw new Error(problem);
        const normalized = normalizeContacts(contacts);
        if ("error" in normalized) throw new Error(normalized.error);

        player.answers = answers;
        player.contacts = normalized.contacts;
        persist.answers(room.id, player.id, answers);
        void buildProfile(room, player, () => broadcastPlayer(room, player));
        return null;
      }),
    );

    socket.on("profile:get", (raw, ack) =>
      guard(ack, () => {
        const { target } = groupMember(raw);
        return { id: target.id, answers: target.answers ?? null, contacts: target.contacts ?? {} };
      }),
    );

    socket.on("profile:match", (raw, ack) =>
      void guardAsync(ack, async () => {
        const { room, player, target } = groupMember(raw);
        return matchSummary(room, player, target);
      }),
    );

    socket.on("host:attach", (req, ack) =>
      guard(ack, () => {
        const { code, hostToken } = hostAttachSchema.parse(req);
        const room = store.get(normalizeRoomCode(code));
        if (!room || room.hostToken !== hostToken) {
          throw new Error("That room has ended. Create a new one.");
        }
        attach(socket, room, "host");
        return toSnapshot(room);
      }),
    );

    socket.on("player:join", (req, ack) =>
      void guardAsync(ack, async () => {
        requireSignedIn(socket);
        const { code, name, playerToken } = joinSchema.parse(req);
        const room = store.get(normalizeRoomCode(code));
        if (!room) throw new Error("No room found for that code");

        let player = playerToken ? store.findPlayerByToken(room, playerToken) : undefined;

        if (!player) {
          const sameName = [...room.players.values()].find(
            (p) => p.name.toLowerCase() === name.toLowerCase(),
          );
          if (sameName?.connected) {
            throw new Error("Someone in this room is already using that name");
          }
          if (sameName) {
            // Same name but offline: a new device or cleared storage. Let them reclaim it.
            player = sameName;
          } else {
            if (!JOINABLE_STAGES.includes(room.stage)) {
              throw new Error("This room has already been sorted");
            }
            if (room.players.size >= MAX_PLAYERS_PER_ROOM) throw new Error("This room is full");
            player = store.addPlayer(room, name);
            console.log(`[room ${room.code}] ${name} joined (${room.players.size} players)`);
          }
        } else if (player.name !== name) {
          // Same player (matched by token) rejoining under a new name.
          const selfId = player.id;
          const clash = [...room.players.values()].some(
            (p) => p.id !== selfId && p.name.toLowerCase() === name.toLowerCase(),
          );
          if (clash) throw new Error("Someone in this room is already using that name");
          player.name = name;
        }

        // A newer tab takes over the player; tell the old tab to stand down.
        if (player.socketId && player.socketId !== socket.id) {
          const previous = io.sockets.sockets.get(player.socketId);
          previous?.emit("session:replaced");
          previous?.disconnect(true);
        }

        player.socketId = socket.id;
        player.connected = true;
        attach(socket, room, "player", player.id);
        persist.player(room.id, player);
        broadcastPlayer(room, player);

        return { playerId: player.id, playerToken: player.token, room: toSnapshot(room) };
      }),
    );

    socket.on("player:customize", (req, ack) =>
      guard(ack, () => {
        const { room, player } = ownPlayer();
        // Only known colours and hats, so one client can't inject arbitrary
        // values into everyone else's scene.
        if (!isPlayerColor(req?.color)) throw new Error("Unknown colour");
        if (!isHatId(req?.hat)) throw new Error("Unknown hat");
        if (!isMouthId(req?.mouth)) throw new Error("Unknown mouth");
        player.color = req.color;
        player.hat = req.hat;
        player.mouth = req.mouth;
        room.lastActiveAt = Date.now();
        broadcastPlayer(room, player);
        return null;
      }),
    );

    socket.on("player:move", (pose) => {
      const { role, code, playerId } = socket.data;
      if (role !== "player" || !code || !playerId) return;
      const room = store.get(code);
      const player = room?.players.get(playerId);
      if (!room || !player || player.socketId !== socket.id) return;
      if (!WALKABLE_STAGES.includes(room.stage)) return;

      const parsed = poseSchema.safeParse(pose);
      if (!parsed.success) return;
      const clamped = clampToArea(
        playerArea(room.stage, player.placement),
        parsed.data.x,
        parsed.data.z,
      );
      player.x = clamped.x;
      player.z = clamped.z;
      player.rotY = parsed.data.rotY;
      room.dirty.add(player.id);
      room.lastActiveAt = Date.now();
    });

    socket.on("player:leave", (ack) =>
      guard(ack, () => {
        const { role, code, playerId } = socket.data;
        const room = code ? store.get(code) : undefined;
        const player = playerId ? room?.players.get(playerId) : undefined;
        if (role !== "player" || !room || !player || player.socketId !== socket.id) return null;

        if (room.stage === "lobby") {
          room.players.delete(player.id);
          room.dirty.delete(player.id);
          persist.removePlayer(room.id, player.id);
          io.to(channel(room.code)).emit("player:removed", { id: player.id });
        } else {
          // After the lobby their answers matter, so keep them and just mark them away.
          player.socketId = null;
          player.connected = false;
          io.to(channel(room.code)).emit("player:left", { id: player.id });
        }
        console.log(`[room ${room.code}] ${player.name} left`);
        socket.leave(channel(room.code));
        socket.data = {};
        return null;
      }),
    );

    socket.on("disconnect", () => {
      const { role, code, playerId } = socket.data;
      if (role !== "player" || !code || !playerId) return;
      const room = store.get(code);
      const player = room?.players.get(playerId);
      // Ignore stale sockets that were already replaced by a newer tab.
      if (!room || !player || player.socketId !== socket.id) return;
      player.socketId = null;
      player.connected = false;
      room.lastActiveAt = Date.now();
      io.to(channel(code)).emit("player:left", { id: player.id });
    });
  });
}

function attach(socket: AppSocket, room: Room, role: "host" | "player", playerId?: string) {
  if (socket.data.code && socket.data.code !== room.code) {
    socket.leave(channel(socket.data.code));
  }
  socket.data = { role, code: room.code, playerId };
  socket.join(channel(room.code));
  room.lastActiveAt = Date.now();
}

/** Broadcasts batched position changes for every room at a fixed rate. */
export function startNetworkTick(io: IO, store: RoomStore, hz: number) {
  return setInterval(() => {
    for (const room of store.all()) {
      if (room.dirty.size === 0) continue;
      const moves = [];
      for (const id of room.dirty) {
        const p = room.players.get(id);
        if (p) moves.push({ id, x: p.x, z: p.z, rotY: p.rotY });
      }
      room.dirty.clear();
      io.to(channel(room.code)).volatile.emit("players:moved", moves);
    }
  }, 1000 / hz);
}

/** Drops rooms that have had no activity for a while so memory stays bounded. */
export function startRoomCleanup(io: IO, store: RoomStore, idleMs: number) {
  return setInterval(() => {
    const now = Date.now();
    for (const room of store.all()) {
      const sockets = io.sockets.adapter.rooms.get(channel(room.code))?.size ?? 0;
      if (sockets === 0 && now - room.lastActiveAt > idleMs) {
        store.delete(room.code);
        console.log(`[room ${room.code}] cleaned up after inactivity`);
      }
    }
  }, 60_000);
}

/** The sorting animation stays up at least this long, even if sorting is instant. */
const MIN_SORT_ANIMATION_MS = 4500;
/** How long sorting waits for profiles that are still being written. */
const MAX_WAIT_FOR_PROFILES_MS = 15_000;

/** Sorts a room in the background, then moves everyone into their biome at once. */
async function runSort(io: IO, room: Room) {
  const started = Date.now();
  const players = () => [...room.players.values()];

  // Students who submitted at the last second deserve a real vector.
  while (
    players().some((p) => p.quiz === "processing") &&
    Date.now() - started < MAX_WAIT_FOR_PROFILES_MS
  ) {
    await sleep(250);
  }

  let vectors: BiomeVectors | null = null;
  try {
    vectors = await getBiomeVectors();
  } catch (err) {
    console.warn(`[sort ${room.code}] biome vectors unavailable, using fallbacks: ${errorMessage(err)}`);
  }

  const candidates: SortCandidate[] = players().map((p) => ({
    id: p.id,
    name: p.name,
    answers: p.answers,
    profile: p.profile,
    embedding: p.embedding,
  }));

  let result: SortResult;
  try {
    result = await sortStudents(candidates, {
      biomeVectors: vectors,
      chooseBiome: process.env.GEMINI_API_KEY
        ? (c) =>
            geminiLimit(() =>
              withRetry(() => chooseBiome({ answers: c.answers!, profile: c.profile?.text }), {
                attempts: 2,
                label: `sort ${c.name}`,
              }),
            )
        : undefined,
    });
  } catch (err) {
    console.error(`[sort ${room.code}] sort failed, using answer rules: ${errorMessage(err)}`);
    result = await sortStudents(candidates, { biomeVectors: null });
  }

  // Place each group in a loose spiral in the middle of its biome.
  const placedPerBiome = new Map<string, number>();
  for (const player of players()) {
    const placement = result.placements.get(player.id);
    if (!placement) continue;
    player.placement = placement;
    const area = biomeArea(placement.biome);
    const slot = placedPerBiome.get(placement.biome) ?? 0;
    placedPerBiome.set(placement.biome, slot + 1);
    // Open spots from the biome's map (clients also nudge anyone who'd overlap a wall).
    const spot = spawnOffset(placement.biome, slot);
    player.x = area.cx + spot.x;
    player.z = area.cz + spot.z;
    player.rotY = 0;
    room.dirty.delete(player.id);
    persist.placement(room.id, player.id, placement);
  }

  const summary = result.details
    .map((d) => `${d.name}->${d.biome} (${d.method}${d.margin === null ? "" : `, margin ${d.margin.toFixed(2)}`})`)
    .join("; ");
  console.log(`[sort ${room.code}] done in ${Date.now() - started}ms: ${summary}`);

  await sleep(Math.max(0, MIN_SORT_ANIMATION_MS - (Date.now() - started)));
  room.stage = "biomes";
  room.lastActiveAt = Date.now();
  persist.room(room);
  io.to(channel(room.code)).emit("room:snapshot", toSnapshot(room));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
