"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Roster = {
  biome: { id: string; name: string; description: string; themeKey: string };
  group: { id: string; code: string; name: string } | null;
  members: Array<{ id: string; officialName: string; quizCompletedAt: string | null }>;
};

const THEME: Record<
  string,
  { sky: string; ground: string; accent: string; label: string }
> = {
  forest: {
    sky: "from-[#0b1f14] via-[#143222] to-[#1f4d33]",
    ground: "bg-[#2f6b3a]",
    accent: "bg-emerald-400",
    label: "Forest",
  },
  canyon: {
    sky: "from-[#2a1208] via-[#5c2a12] to-[#a85a2a]",
    ground: "bg-[#c97a3a]",
    accent: "bg-orange-300",
    label: "Canyon",
  },
  meadow: {
    sky: "from-[#16301f] via-[#2d5a35] to-[#7db86a]",
    ground: "bg-[#8fc56a]",
    accent: "bg-lime-300",
    label: "Meadow",
  },
  summit: {
    sky: "from-[#0d1520] via-[#243447] to-[#6f8aa8]",
    ground: "bg-[#8aa0b8]",
    accent: "bg-sky-300",
    label: "Summit",
  },
  river: {
    sky: "from-[#071820] via-[#0f3a4a] to-[#2a7a8a]",
    ground: "bg-[#3a8f9a]",
    accent: "bg-cyan-300",
    label: "River",
  },
  forge: {
    sky: "from-[#1a0e08] via-[#3d2414] to-[#7a4a22]",
    ground: "bg-[#8b5a2b]",
    accent: "bg-amber-300",
    label: "Forge",
  },
};

export default function BiomePage() {
  const params = useParams<{ id: string }>();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/biomes/${params.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Biome not found");
        if (!cancelled) setRoster(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load biome");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const theme = useMemo(() => {
    const key = roster?.biome.themeKey ?? "forest";
    return THEME[key] ?? THEME.forest!;
  }, [roster]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a140f] text-sm text-emerald-100/60">
        Entering biome…
      </div>
    );
  }

  if (!roster) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted-foreground">Biome not found.</p>
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-gradient-to-b text-white", theme.sky)}>
      {/* Voxel-ish placeholder world */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 2px, transparent 2px), linear-gradient(to bottom, rgba(255,255,255,0.06) 2px, transparent 2px)",
          backgroundSize: "32px 32px",
          imageRendering: "pixelated",
        }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh]"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={cn("absolute inset-x-0 bottom-0 h-[55%] opacity-90", theme.ground)} />
        <div className="absolute bottom-[48%] left-[12%] h-24 w-24 bg-black/25" />
        <div className="absolute bottom-[48%] left-[18%] h-16 w-16 bg-black/20" />
        <div className="absolute bottom-[50%] right-[18%] h-28 w-20 bg-black/25" />
        <div className="absolute bottom-[52%] right-[28%] h-14 w-14 bg-black/15" />
        <div
          className={cn(
            "absolute bottom-[58%] left-1/2 h-10 w-10 -translate-x-1/2 rounded-sm shadow-[0_0_40px_rgba(255,255,255,0.25)]",
            theme.accent,
          )}
        />
      </motion.div>

      <header className="relative z-20 flex items-start justify-between gap-4 px-5 py-5 md:px-8">
        <div>
          <Link href="/" className="text-xs text-white/60 hover:text-white">
            ← Leave biome
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl"
          >
            {roster.biome.name}
          </motion.h1>
          <p className="mt-2 max-w-md text-sm text-white/70">{roster.biome.description}</p>
          {roster.group && (
            <p className="mt-2 text-xs text-white/45">
              {roster.group.name} · <span className="font-mono tracking-widest">{roster.group.code}</span>
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "h-11 shrink-0 rounded-xl border border-white/20 bg-black/35 px-4 text-white shadow-lg backdrop-blur hover:bg-black/50",
          )}
        >
          <Users className="h-4 w-4" />
          Members ({roster.members.length})
        </Button>
      </header>

      <div className="relative z-10 mx-auto mt-10 max-w-lg px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-white/15 bg-black/25 px-5 py-4 text-sm text-white/75 backdrop-blur"
        >
          3D Minecraft-style biome coming next. For now this is your matched working-style
          world — open Members to see everyone paired here.
        </motion.p>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close members"
              className="fixed inset-0 z-40 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#0b1210]/95 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <div className="text-sm font-medium">Biome members</div>
                  <div className="text-xs text-white/50">{roster.biome.name}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ul className="flex-1 space-y-1 overflow-y-auto p-3">
                {roster.members.length === 0 ? (
                  <li className="px-3 py-8 text-center text-sm text-white/45">
                    No one else here yet.
                  </li>
                ) : (
                  roster.members.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-xl px-3 py-3 text-sm hover:bg-white/5"
                    >
                      {m.officialName}
                    </li>
                  ))
                )}
              </ul>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
