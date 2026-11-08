import type { HostSession } from "@unify/shared";

export type PlayerSession = { name: string; playerToken: string };

const HOST_KEY = "unify:host";
const playerKey = (code: string) => `unify:player:${code}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
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
  load: (code: string) => read<PlayerSession>(playerKey(code)),
  save: (code: string, session: PlayerSession) => write(playerKey(code), session),
  clear: (code: string) => write(playerKey(code), null),
};
