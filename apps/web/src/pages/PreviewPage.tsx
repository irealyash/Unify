import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  BIOMES,
  BIOME_BY_ID,
  PLAYER_COLORS,
  biomeArea,
  isBiomeId,
  type PlayerState,
} from "@unify/shared";
import { useRoom } from "@/game/store";
import { WorldScene } from "@/game/WorldScene";

const SELF_ID = "preview-self";

/**
 * Dev-only: jump straight into a biome to work on its scene without running a room
 * through the quiz and sort. /preview/night_city, or add ?view=host for the overview.
 */
export function PreviewPage() {
  const biomeParam = useParams().biome;
  const [params] = useSearchParams();
  const hostView = params.get("view") === "host";
  const biome = isBiomeId(biomeParam) ? biomeParam : BIOMES[0]!.id;

  useEffect(() => {
    const players: PlayerState[] = [];
    // Everyone gets a group: you plus a few dummies in each biome.
    for (const b of BIOMES) {
      const area = biomeArea(b.id);
      const count = b.id === biome ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const isSelf = b.id === biome && i === 0;
        const angle = i * 2.4;
        const radius = isSelf ? 0 : 2 + Math.sqrt(i) * 1.4;
        players.push({
          id: isSelf ? SELF_ID : `dummy-${b.id}-${i}`,
          name: isSelf ? "Preview" : `${b.name.split(" ")[0]} ${i}`,
          color: PLAYER_COLORS[(i + (b.id === biome ? 0 : 4)) % PLAYER_COLORS.length]!,
          x: area.cx + Math.cos(angle) * radius,
          z: area.cz + 3 + Math.sin(angle) * radius,
          rotY: 0,
          connected: true,
          quiz: "ready",
          placement: { biome: b.id, method: "vector", reason: "Preview" },
        });
      }
    }
    const { applySnapshot, reset } = useRoom.getState();
    applySnapshot({ code: "PREVIEW", stage: "biomes", players }, hostView ? null : SELF_ID);
    return () => reset();
  }, [biome, hostView]);

  return (
    <div className="relative h-full bg-[#070816]">
      <WorldScene selfId={hostView ? null : SELF_ID} spectator={hostView} />
      <div className="hud absolute left-4 top-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-2.5 text-sm">
        <span className="font-semibold">Preview · {BIOME_BY_ID.get(biome)!.name}</span>
        {BIOMES.map((b) => (
          <Link key={b.id} to={`/preview/${b.id}${hostView ? "?view=host" : ""}`} className="hud-muted underline-offset-2 hover:underline">
            {b.name}
          </Link>
        ))}
        <Link to={`/preview/${biome}${hostView ? "" : "?view=host"}`} className="hud-muted underline-offset-2 hover:underline">
          {hostView ? "Player view" : "Host view"}
        </Link>
      </div>
    </div>
  );
}
