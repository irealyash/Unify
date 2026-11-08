import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  BIOMES,
  BIOME_BY_ID,
  HATS,
  MOUTHS,
  PLAYER_COLORS,
  biomeArea,
  isBiomeId,
  spawnOffset,
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
  // ?at=x,z puts you at a spot (relative to the biome center), e.g. ?at=0,-12.
  const at = params.get("at")?.split(",").map(Number);
  const start = at && at.length === 2 && at.every(Number.isFinite) ? { x: at[0]!, z: at[1]! } : null;
  const biome = isBiomeId(biomeParam) ? biomeParam : BIOMES[0]!.id;

  useEffect(() => {
    const players: PlayerState[] = [];
    // Just you in the previewed biome; a few dummies elsewhere so the host view isn't empty.
    for (const b of BIOMES) {
      const area = biomeArea(b.id);
      const count = b.id === biome ? 1 : 3;
      for (let i = 0; i < count; i++) {
        const isSelf = b.id === biome && i === 0;
        const spot = spawnOffset(b.id, i);
        players.push({
          id: isSelf ? SELF_ID : `dummy-${b.id}-${i}`,
          name: isSelf ? "Preview" : `${b.name.split(" ")[0]} ${i}`,
          color: PLAYER_COLORS[(i + (b.id === biome ? 0 : 4)) % PLAYER_COLORS.length]!,
          // Cycle the hats so the preview shows each one off.
          hat: HATS[(i + (b.id === biome ? 0 : 2)) % HATS.length]!.id,
          mouth: MOUTHS[(i + (b.id === biome ? 0 : 3)) % MOUTHS.length]!.id,
          x: area.cx + (isSelf && start ? start.x : spot.x),
          z: area.cz + (isSelf && start ? start.z : spot.z),
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
  }, [biome, hostView, start?.x, start?.z]);

  return (
    <div className="relative h-full bg-[#070816]">
      <WorldScene selfId={hostView ? null : SELF_ID} spectator={hostView} />
      <div className="hud absolute left-4 top-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-2.5 text-sm">
        <span className="font-semibold">Preview {BIOME_BY_ID.get(biome)!.name}</span>
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
