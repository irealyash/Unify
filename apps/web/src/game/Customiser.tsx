import { Check, Star, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  HATS,
  MOUTHS,
  PLAYER_COLORS,
  type HatId,
  type MouthId,
  type PlayerState,
} from "@unify/shared";
import { request } from "@/lib/socket";
import { cn } from "@/lib/utils";

/**
 * Lobby panel for changing your own character's colour, hat and mouth.
 *
 * Choices are sent to the server, which validates them and broadcasts the
 * updated player to the room — so the swatch state here just mirrors whatever
 * came back in `self`, rather than keeping a second copy that could drift.
 */
export function Customiser({ self }: { self: PlayerState }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function apply(next: { color?: string; hat?: HatId; mouth?: MouthId }) {
    const payload = {
      color: next.color ?? self.color,
      hat: next.hat ?? self.hat,
      mouth: next.mouth ?? self.mouth,
    };
    if (
      payload.color === self.color &&
      payload.hat === self.hat &&
      payload.mouth === self.mouth
    ) {
      return;
    }
    setBusy(true);
    try {
      await request("player:customize", payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your character");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hud pointer-events-auto flex items-center gap-2 rounded-sm px-3 py-2 text-base transition hover:opacity-90"
      >
        <Star className="h-5 w-5" />
        Customize character
      </button>
    );
  }

  return (
    <div className="hud pointer-events-auto w-60 rounded-sm p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="hud-muted font-handwritten text-sm tracking-wider">Your character</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close customiser"
          className="transition hover:opacity-70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4">
        <div className="hud-muted mb-2 text-sm">Colour</div>
        <div className="grid grid-cols-5 gap-2">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy}
              onClick={() => void apply({ color: c })}
              aria-label={`Colour ${c}`}
              aria-pressed={c === self.color}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 transition disabled:opacity-50",
                c === self.color ? "border-[#f5f1ed]" : "border-transparent hover:opacity-80",
              )}
              style={{ background: c }}
            >
              {c === self.color ? <Check className="h-3.5 w-3.5 text-[#46382f]" /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="hud-muted mb-2 text-sm">Hat</div>
        <div className="grid grid-cols-2 gap-1.5">
          {HATS.map((h) => (
            <button
              key={h.id}
              type="button"
              disabled={busy}
              onClick={() => void apply({ hat: h.id })}
              aria-pressed={h.id === self.hat}
              className={cn(
                "rounded-sm px-2 py-1.5 text-left font-handwritten text-sm transition disabled:opacity-50",
                h.id === self.hat
                  ? "bg-[#f5f1ed] font-medium text-[#26305c]"
                  : "bg-[#f5f1ed]/10 hover:bg-[#f5f1ed]/20",
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="hud-muted mb-2 text-sm">Mouth</div>
        <div className="grid grid-cols-3 gap-1.5">
          {MOUTHS.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={busy}
              onClick={() => void apply({ mouth: m.id })}
              aria-label={m.label}
              aria-pressed={m.id === self.mouth}
              className={cn(
                "flex items-center justify-center rounded-sm py-1.5 transition disabled:opacity-50",
                m.id === self.mouth
                  ? "bg-[#f5f1ed] text-[#26305c]"
                  : "bg-[#f5f1ed]/10 hover:bg-[#f5f1ed]/20",
              )}
            >
              <MouthGlyph mouth={m.id} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tiny 2D echo of each mouth shape, so the picker shows the shape not a word. */
function MouthGlyph({ mouth }: { mouth: MouthId }) {
  const paths: Record<MouthId, string> = {
    smile: "M3 6 Q10 13 17 6",
    frown: "M3 11 Q10 4 17 11",
    v: "M6 6 L10 11 L14 6",
    circle: "M7 8.5 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0",
    flat: "M4 9 L16 9",
    cat: "M3 7 Q6.5 12 10 7 Q13.5 12 17 7",
  };
  return (
    <svg viewBox="0 0 20 17" className="h-5 w-6" aria-hidden="true">
      <path
        d={paths[mouth]}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
