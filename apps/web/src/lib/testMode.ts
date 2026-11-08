/**
 * Test mode: use the app without signing in, for local development. It only exists in dev
 * builds, and the server only honors it when started with `npm run dev` (--allow-test-mode).
 */

const KEY = "unify:test-mode";

export const TEST_MODE_AVAILABLE = import.meta.env.DEV;

export function isTestMode() {
  if (!TEST_MODE_AVAILABLE) return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Where a player's session and quiz drafts live. Normally that's shared across tabs, so closing
 * a tab and coming back rejoins as the same person. In test mode each tab is its own person.
 */
export function playerStore(): Storage {
  return isTestMode() ? sessionStorage : localStorage;
}

/** Turns test mode on or off, reloading so the socket reconnects with the right credentials. */
export function setTestMode(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: test mode just stays off.
  }
  window.location.reload();
}
