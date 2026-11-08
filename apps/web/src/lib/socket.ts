import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  AckResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@unify/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// In dev, Vite proxies /socket.io to the game server, so connecting to our own origin works.
// In production, point VITE_SERVER_URL at the deployed server.
const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined;

export const socket: AppSocket = serverUrl ? io(serverUrl) : io();

/** Attach Auth0 ID token so join/host can require Google sign-in. Reconnects when needed. */
export function setSocketAuthToken(token: string | null): Promise<void> {
  const next = token ? { token } : {};
  const prev = (socket.auth as { token?: string } | undefined)?.token ?? null;
  const changed = (token ?? null) !== prev;
  socket.auth = next;

  if (!changed && socket.connected) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      socket.off("connect", done);
      resolve();
    };
    socket.once("connect", done);
    if (socket.connected) socket.disconnect().connect();
    else socket.connect();
  });
}

const REQUEST_TIMEOUT_MS = 8000;

type Events = ClientToServerEvents;
/** Client events whose last argument is an ack callback. */
type RequestEvent = {
  [E in keyof Events]: Parameters<Events[E]> extends [...unknown[], Ack<never>] ? E : never;
}[keyof Events];
type RequestArgs<E extends RequestEvent> =
  Parameters<Events[E]> extends [...infer A, Ack<never>] ? A : never;
type RequestData<E extends RequestEvent> =
  Parameters<Events[E]> extends [...unknown[], Ack<infer T>] ? T : never;

/** Emits an event, waits for the server's ack, and returns its data or throws its error. */
export async function request<E extends RequestEvent>(
  event: E,
  ...args: RequestArgs<E>
): Promise<RequestData<E>> {
  // socket.io's types drop the ack's payload type once a timeout is set, so we restore it here.
  const timed = socket.timeout(REQUEST_TIMEOUT_MS) as unknown as {
    emitWithAck(event: string, ...args: unknown[]): Promise<AckResult<RequestData<E>>>;
  };
  const result = await timed.emitWithAck(event, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Runs `fn` now if connected and again after every reconnect. Returns a cleanup. */
export function onEveryConnect(fn: () => void) {
  if (socket.connected) fn();
  socket.on("connect", fn);
  return () => {
    socket.off("connect", fn);
  };
}
