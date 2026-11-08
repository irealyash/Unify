import { useEffect, useRef } from "react";

const MOVEMENT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Tracks currently held movement keys by physical key code (layout independent). */
export function useMovementKeys() {
  const pressed = useRef(new Set<string>());

  useEffect(() => {
    const keys = pressed.current;
    const down = (e: KeyboardEvent) => {
      if (!MOVEMENT_KEYS.has(e.code) || isTyping(e.target)) return;
      e.preventDefault();
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const clear = () => keys.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  return pressed;
}

/** Converts held keys into a normalized (x, z) direction in world space. */
export function readDirection(keys: Set<string>) {
  let x = 0;
  let z = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  const len = Math.hypot(x, z);
  return len === 0 ? null : { x: x / len, z: z / len };
}
