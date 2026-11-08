import { ArrowRight } from "lucide-react";
import { BIOME_BY_ID, type PlayerState } from "@unify/shared";

type BiomeRevealProps = {
  self: PlayerState;
  teammates: PlayerState[];
  onClose: () => void;
};

/** "You've been sorted into…" card shown once when a student lands in their biome. */
export function BiomeReveal({ self, teammates, onClose }: BiomeRevealProps) {
  const biome = self.placement ? BIOME_BY_ID.get(self.placement.biome) : undefined;
  if (!biome || !self.placement) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/50 p-4 backdrop-blur-[2px]">
      <div className="unify-pop w-full max-w-md overflow-hidden rounded-2xl bg-white text-[#0f1222] shadow-[0_24px_60px_-24px_rgba(15,18,34,0.4)]">
        <div className="px-7 pb-6 pt-7 text-white" style={{ background: biome.colors.accent }}>
          <div className="text-sm opacity-80">You've been sorted into</div>
          <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight">{biome.name}</h2>
          <p className="mt-2 opacity-90">{biome.tagline}</p>
        </div>

        <div className="space-y-5 px-7 py-6">
          <p className="text-[15px] leading-relaxed text-[#3a3f55]">“{self.placement.reason}”</p>

          <div>
            <div className="mb-2 text-xs font-medium tracking-wider text-[#8a8fa0]">
              Your group · {teammates.length + 1}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <NameChip name={`${self.name} (you)`} color={self.color} />
              {teammates.map((p) => (
                <NameChip key={p.id} name={p.name} color={p.color} />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f1222] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#262a40]"
          >
            Explore {biome.name}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NameChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-[#e3e5ea] px-2.5 py-1 text-sm">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}
