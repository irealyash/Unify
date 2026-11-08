import {
  BIOMES,
  DEMO_BOT_COUNT,
  HATS,
  MAX_PLAYERS_PER_ROOM,
  MOUTHS,
  QUESTIONS,
  WALKABLE_STAGES,
  biomeArea,
  clampToArea,
  playerArea,
  type BiomeId,
  type Placement,
  type QuizAnswers,
  type Stage,
} from "@unify/shared";
import type { Player, Room, RoomStore } from "./rooms";
import { rulesPrefs } from "./sort";

/**
 * Demo bots: pretend students a host can add to fill out a room. They live only on the server
 * and in memory. They skip Gemini and the database, and are sorted after the real players so
 * they can't change where anyone real ends up.
 */

const NAMES = [
  "Maya", "Theo", "Priya", "Kai", "Lena", "Omar", "Nia", "Ben", "Rosa", "Iris",
  "Noor", "Sam", "Ivy", "Leo", "Tara", "Finn", "Zoe", "Ravi", "Mina", "Jude",
  "Ana", "Hugo", "Elif", "Cole", "Suki", "Max", "Lila", "Dev", "Nora", "Eli",
  "Yuki", "Gabe", "Tess", "Amir", "Cleo", "Owen", "Sana", "Ezra", "Luz", "Remy",
];

/** Written answers for bots to pick from. Most bots leave one or both blank, like real students. */
const WRITTEN: Record<string, string[]> = {
  ideal: [
    "Split the work early, check in once a week, and no last-minute panic.",
    "A friendly group where everyone pitches in and we actually enjoy it.",
    "Clear roles and a shared doc so nobody has to chase anybody.",
    "Lots of time working side by side and bouncing ideas around.",
    "Low stress. We each do our part and bring it together at the end.",
  ],
  notes: [
    "I work part-time on weekends, so weekdays are best for me.",
    "I'm happiest doing research and writing.",
    "I reply fastest on Discord.",
    "I like having a plan before we start.",
    "I'm a night owl, so expect messages at odd hours.",
  ],
};

const SPEED = 2.2;
/** How far from their spot a bot wanders. */
const WANDER_RADIUS = 3.5;
/** How far out bots stand, as a share of the biome's size: clear of the middle, where people start. */
const NEAREST_SPOT = 0.45;
const FURTHEST_SPOT = 0.9;
const MIN_PAUSE_MS = 1000;
const MAX_PAUSE_MS = 5000;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** Adds up to a batch of bots, as many as fit in the room. */
export function addBots(room: Room, store: RoomStore): Player[] {
  const spaceLeft = MAX_PLAYERS_PER_ROOM - room.players.size;
  if (spaceLeft <= 0) throw new Error("This room is full");

  const taken = new Set([...room.players.values()].map((p) => p.name.toLowerCase()));
  const free = NAMES.filter((name) => !taken.has(name.toLowerCase()));
  let extra = 2;
  const nextName = () => {
    if (free.length > 0) return free.splice(Math.floor(Math.random() * free.length), 1)[0]!;
    // Out of names (several batches in one room): number them instead.
    while (taken.has(`bot ${extra}`)) extra++;
    taken.add(`bot ${extra}`);
    return `Bot ${extra}`;
  };

  const added: Player[] = [];
  for (let i = 0; i < Math.min(DEMO_BOT_COUNT, spaceLeft); i++) {
    const bot = store.addPlayer(room, nextName());
    bot.bot = true;
    bot.connected = true;
    bot.hat = pick(HATS).id;
    bot.mouth = pick(MOUTHS).id;
    added.push(bot);
  }
  return added;
}

function randomAnswers(): QuizAnswers {
  const answers: QuizAnswers = {};
  for (const q of QUESTIONS) {
    if (q.kind === "choice") answers[q.id] = pick(q.options).id;
    else if (WRITTEN[q.id] && Math.random() < 0.5) answers[q.id] = pick(WRITTEN[q.id]!);
  }
  return answers;
}

/** Hands in random answers for any bot that hasn't yet. Returns the ones that changed. */
export function answerBots(room: Room): Player[] {
  const answered: Player[] = [];
  for (const player of room.players.values()) {
    if (!player.bot || player.answers) continue;
    player.answers = randomAnswers();
    player.quiz = "ready";
    answered.push(player);
  }
  return answered;
}

/** Puts each bot in whichever biome has the fewest people, so every area fills up evenly. */
export function placeBots(room: Room, placements: Map<string, Placement>) {
  const counts = new Map<BiomeId, number>(BIOMES.map((b) => [b.id, 0]));
  for (const placement of placements.values()) {
    counts.set(placement.biome, counts.get(placement.biome)! + 1);
  }
  for (const player of room.players.values()) {
    if (!player.bot) continue;
    // Their random answers only settle ties, which is what makes the groups differ between runs.
    const biome = rulesPrefs(player.answers).reduce((best, id) =>
      counts.get(id)! < counts.get(best)! ? id : best,
    );
    counts.set(biome, counts.get(biome)! + 1);
    placements.set(player.id, {
      biome,
      method: "bot",
      reason: "A demo bot with random answers, placed to fill out this group.",
    });
  }
}

/**
 * Where the n-th bot in a biome stands, relative to its center. Real people start in the middle,
 * but bots are there to fill the place out, so they spread across all of it. They may land on
 * something solid: browsers move them to the nearest free spot when drawing them.
 */
export function botSpot(biome: BiomeId, slot: number) {
  const half = biomeArea(biome).half;
  const share = NEAREST_SPOT + (FURTHEST_SPOT - NEAREST_SPOT) * ((slot * 0.618) % 1);
  const angle = slot * 2.4;
  return { x: Math.cos(angle) * half * share, z: Math.sin(angle) * half * share };
}

type Walk = {
  stage: Stage;
  homeX: number;
  homeZ: number;
  targetX: number;
  targetZ: number;
  resumeAt: number;
};

const walks = new WeakMap<Player, Walk>();

function stepBot(room: Room, bot: Player, now: number, stride: number) {
  let walk = walks.get(bot);
  // A new stage means a new place to wander around (they get moved when the room is sorted).
  if (!walk || walk.stage !== room.stage) {
    walk = { stage: room.stage, homeX: bot.x, homeZ: bot.z, targetX: bot.x, targetZ: bot.z, resumeAt: 0 };
    walks.set(bot, walk);
  }
  if (now < walk.resumeAt) return;

  const dx = walk.targetX - bot.x;
  const dz = walk.targetZ - bot.z;
  const distance = Math.hypot(dx, dz);

  if (distance <= stride) {
    // Arrived: stand around for a moment, then head somewhere else nearby.
    const angle = Math.random() * Math.PI * 2;
    const reach = Math.random() * WANDER_RADIUS;
    const next = clampToArea(
      playerArea(room.stage, bot.placement),
      walk.homeX + Math.cos(angle) * reach,
      walk.homeZ + Math.sin(angle) * reach,
    );
    walk.targetX = next.x;
    walk.targetZ = next.z;
    walk.resumeAt = now + MIN_PAUSE_MS + Math.random() * (MAX_PAUSE_MS - MIN_PAUSE_MS);
    return;
  }

  bot.x += (dx / distance) * stride;
  bot.z += (dz / distance) * stride;
  bot.rotY = Math.atan2(dx, dz);
  room.dirty.add(bot.id);
}

/** Keeps every bot wandering. The network tick sends their new positions with everyone else's. */
export function startBotWalking(store: RoomStore, hz: number) {
  const stride = SPEED / hz;
  return setInterval(() => {
    const now = Date.now();
    for (const room of store.all()) {
      if (!WALKABLE_STAGES.includes(room.stage)) continue;
      for (const player of room.players.values()) {
        if (player.bot) stepBot(room, player, now, stride);
      }
    }
  }, 1000 / hz);
}
