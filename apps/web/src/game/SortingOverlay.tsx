import { useEffect, useState, type CSSProperties } from "react";
import { BIOMES, type PlayerState } from "@unify/shared";

const MESSAGES = [
  "Reading the vibes…",
  "Comparing working styles…",
  "Asking Gemini about the close calls…",
  "Balancing the groups…",
];

const MAX_DOTS = 24;

/** Full-screen "sorting" moment while the server assigns biomes. */
export function SortingOverlay({ players }: { players: PlayerState[] }) {
  const [message, setMessage] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMessage((m) => (m + 1) % MESSAGES.length), 1200);
    return () => window.clearInterval(id);
  }, []);

  const colors = players.slice(0, MAX_DOTS).map((p) => p.color);
  const [left, right] = [BIOMES[0]!, BIOMES[BIOMES.length - 1]!];

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10 bg-white/75 px-4 text-[#0f1222] backdrop-blur-sm">
      <div className="flex items-center gap-6 sm:gap-14">
        <BiomeChip name={left.name} color={left.colors.accent} side="left" />

        <div className="relative h-40 w-40 shrink-0">
          {colors.map((color, i) => {
            const style = {
              "--start": `${(360 / Math.max(colors.length, 1)) * i}deg`,
              "--r": `${34 + (i % 3) * 14}px`,
              background: color,
              animationDuration: `${2.2 + (i % 4) * 0.35}s`,
            } as CSSProperties;
            return (
              <span
                key={i}
                className="unify-orbit absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full shadow-sm"
                style={style}
              />
            );
          })}
          {colors.map((color, i) => {
            const toLeft = i % 2 === 0;
            const style = {
              "--dx": `${toLeft ? -150 : 150}px`,
              "--dy": `${((i * 37) % 60) - 30}px`,
              background: color,
              animationDelay: `${(i * 0.23) % 2.4}s`,
            } as CSSProperties;
            return (
              <span
                key={`fly-${i}`}
                className="unify-fly absolute left-1/2 top-1/2 -ml-1 -mt-1 hidden h-2 w-2 rounded-full sm:block"
                style={style}
              />
            );
          })}
        </div>

        <BiomeChip name={right.name} color={right.colors.accent} side="right" />
      </div>

      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Sorting into biomes</h2>
        <p key={message} className="unify-fade-in mt-2 text-[#6b7080]">
          {MESSAGES[message]}
        </p>
      </div>
    </div>
  );
}

function BiomeChip({ name, color, side }: { name: string; color: string; side: "left" | "right" }) {
  return (
    <div
      className="unify-pulse hidden h-28 w-28 flex-col items-center justify-center rounded-2xl text-center text-sm font-semibold text-white shadow-lg sm:flex"
      style={{ background: color, animationDelay: side === "left" ? "0s" : "0.6s" }}
    >
      {name}
    </div>
  );
}
