import { useEffect, useState, type CSSProperties } from "react";
import { BIOMES, PLAYER_COLORS, type PlayerState } from "@unify/shared";
import { BiomeIcon } from "./BiomeIcon";

const MESSAGES = [
  "Reading the vibes…",
  "Comparing working styles…",
  "Asking Gemini about the close calls…",
  "Balancing the groups…",
];

/** Always a full swarm of dots: players' own colors first, then the palette fills in the rest. */
const DOT_COUNT = 24;
/** How many of them stream outward from behind the carousel instead of circling it. */
const STREAMING = 8;
const TURN_MS = 900;

/**
 * The carousel's positions, as if the icons stood on a slowly turning ring: one at the front,
 * one either side, and one small and faded behind. `x` is in units of the carousel's spread.
 */
const SLOTS = [
  { x: 0, scale: 1.3, opacity: 1, z: 3 },
  { x: 1, scale: 0.8, opacity: 0.8, z: 2 },
  { x: 0, scale: 0.55, opacity: 0.3, z: 1 },
  { x: -1, scale: 0.8, opacity: 0.8, z: 2 },
];

/** Full-screen "sorting" moment while the server assigns biomes. */
export function SortingOverlay({ players }: { players: PlayerState[] }) {
  const [message, setMessage] = useState(0);
  const [front, setFront] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setMessage((m) => (m + 1) % MESSAGES.length), 1200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setFront((f) => (f + 1) % BIOMES.length), TURN_MS);
    return () => window.clearInterval(id);
  }, []);

  const colors = Array.from(
    { length: DOT_COUNT },
    (_, i) => players[i]?.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length]!,
  );

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-card/85 px-4 text-card-foreground backdrop-blur-sm">
      <div className="relative h-72 w-full max-w-lg">
        {colors.map((color, i) => {
          if (i < STREAMING) {
            const angle = (i / STREAMING) * Math.PI * 2 + 0.4;
            const style = {
              "--dx": `${Math.cos(angle) * 230}px`,
              "--dy": `${Math.sin(angle) * 150}px`,
              background: color,
              animationDelay: `${(i * 0.37) % 2.4}s`,
            } as CSSProperties;
            return (
              <span
                key={i}
                className="unify-fly absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full"
                style={style}
              />
            );
          }
          // A loose cluster circling the carousel, at a mix of distances, sizes and speeds.
          const style = {
            "--start": `${(i * 360) / (DOT_COUNT - STREAMING) + (i % 5) * 9}deg`,
            "--r": `min(${132 + ((i * 7) % 5) * 15}px, 42vw)`,
            background: color,
            animationDuration: `${3 + (i % 4) * 0.55}s`,
          } as CSSProperties;
          return (
            <span
              key={i}
              className={`unify-orbit absolute left-1/2 top-1/2 rounded-full shadow-sm ${i % 3 === 0 ? "-ml-2 -mt-2 h-4 w-4" : "-ml-1.5 -mt-1.5 h-3 w-3"}`}
              style={style}
            />
          );
        })}

        {BIOMES.map((biome, i) => {
          const slot = SLOTS[(i - front + BIOMES.length) % BIOMES.length]!;
          return (
            <div
              key={biome.id}
              className="absolute left-1/2 top-1/2 -ml-16 -mt-16 h-32 w-32 overflow-hidden rounded-2xl shadow-[4px_6px_0_rgba(60,75,129,0.25)] transition-all duration-500 ease-in-out motion-reduce:transition-none"
              style={{
                transform: `translateX(calc(${slot.x} * min(10.5rem, 28vw))) scale(${slot.scale})`,
                opacity: slot.opacity,
                zIndex: slot.z,
              }}
            >
              <BiomeIcon biome={biome.id} className="h-full w-full" />
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <p key={BIOMES[front]!.id} className="unify-fade-in mb-3 font-handwritten text-lg font-semibold">
          {BIOMES[front]!.name}
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-primary">
          Sorting into biomes
        </h2>
        <p key={message} className="unify-fade-in mt-2 font-serif text-muted-foreground">
          {MESSAGES[message]}
        </p>
      </div>
    </div>
  );
}
