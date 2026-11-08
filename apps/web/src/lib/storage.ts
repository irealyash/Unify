import type { HostSession } from "@unify/shared";

export type PlayerSession = { name: string; playerToken: string };

const HOST_KEY = "unify:host";
const playerKey = (code: string) => `unify:player:${code}`;

/** Per tab, so each browser tab can be its own person in a room. */
const playerStore = () => sessionStorage;

function read<T>(key: string, store: () => Storage = () => localStorage): T | null {
  try {
    const raw = store().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown, store: () => Storage = () => localStorage) {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the session just won't survive a refresh.
  }
}

export const hostStorage = {
  load: () => read<HostSession>(HOST_KEY),
  save: (session: HostSession) => write(HOST_KEY, session),
  clear: () => write(HOST_KEY, null),
};

export const playerStorage = {
  load: (code: string) => read<PlayerSession>(playerKey(code), playerStore),
  save: (code: string, session: PlayerSession) => write(playerKey(code), session, playerStore),
  clear: (code: string) => write(playerKey(code), null, playerStore),
};
