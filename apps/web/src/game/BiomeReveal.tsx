import { ArrowRight } from "lucide-react";
import { BIOME_BY_ID, type PlayerState } from "@unify/shared";
import { BookmarkTag } from "@/components/BookmarkTag";
import { Button } from "@/components/ui/button";

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
      {/* The bookmark hangs over the card's top edge, so it sits outside the
          overflow-hidden wrapper that clips the header band's rounded corners. */}
      <div className="unify-pop relative w-full max-w-md">
        <BookmarkTag className="pointer-events-none absolute -top-1 right-6 z-20 h-9 w-7 origin-top scale-y-150" />

        <div className="overflow-hidden rounded-sm bg-card text-card-foreground shadow-[0_24px_60px_-24px_rgba(15,18,34,0.4)]">
          <div
            className="px-7 pb-6 pt-7 text-primary-foreground"
            style={{ background: biome.colors.accent }}
          >
            <div className="text-sm opacity-80">You've been sorted into</div>
            <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight">
              {biome.name}
            </h2>
            <p className="mt-2 opacity-90">{biome.tagline}</p>
          </div>

          <div className="space-y-5 px-7 py-6">
            <div className="text-base font-medium tracking-wider text-muted-foreground">
              {teammates.length} others in this biome
            </div>

            <Button type="button" onClick={onClose} size="lg" className="h-11 w-full">
              Meet my future teammates!
              <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
