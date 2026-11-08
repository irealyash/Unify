import { createServer } from "node:http";
import { Server } from "socket.io";
import { NETWORK_TICK_HZ } from "@unify/shared";
import { getBiomeVectors } from "./ai/biomes";
import { startBotWalking } from "./bots";
import { errorMessage } from "./ai/gemini";
import {
  registerHandlers,
  startNetworkTick,
  startRoomCleanup,
  type IO,
} from "./handlers";
import { handleHttp } from "./http";
import { RoomStore } from "./rooms";

const PORT = Number(process.env.PORT) || 3001;
const WEB_ORIGINS = (process.env.WEB_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const httpServer = createServer((req, res) => {
  if (!handleHttp(req, res)) res.writeHead(404).end();
});

const io: IO = new Server(httpServer, {
  cors: { origin: WEB_ORIGINS },
});

const store = new RoomStore();
registerHandlers(io, store);
startNetworkTick(io, store, NETWORK_TICK_HZ);
startBotWalking(store, NETWORK_TICK_HZ);
startRoomCleanup(io, store, 60 * 60 * 1000);

// Warm the biome vectors so the first sort is fast; a failure here is retried at sort time.
getBiomeVectors().catch((err: unknown) => {
  console.warn(`[biomes] not ready yet: ${errorMessage(err)}`);
});

httpServer.listen(PORT, () => {
  console.log(`Unify server listening on http://localhost:${PORT}`);
});
