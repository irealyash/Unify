"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Roster = {
  biome: { id: string; name: string; description: string; themeKey: string };
  group: { id: string; code: string; name: string } | null;
  members: Array<{ id: string; officialName: string; quizCompletedAt: string | null }>;
};

const THEME: Record<string, { wash: string; tile: string }> = {
  forest: { wash: "from-emerald-50 to-white", tile: "bg-emerald-100" },
  canyon: { wash: "from-orange-50 to-white", tile: "bg-orange-100" },
  meadow: { wash: "from-lime-50 to-white", tile: "bg-lime-100" },
  summit: { wash: "from-sky-50 to-white", tile: "bg-sky-100" },
  river: { wash: "from-cyan-50 to-white", tile: "bg-cyan-100" },
  forge: { wash: "from-amber-50 to-white", tile: "bg-amber-100" },
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
      <div className="min-h-screen bg-[#f7f8fa]">
        <SiteHeader />
        <div className="py-32 text-center text-sm text-[#9aa0a6]">Entering biome…</div>
      </div>
    );
  }

  if (!roster) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <SiteHeader />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24">
          <p className="text-[#5f6368]">Biome not found.</p>
          <Button asChild className="rounded-full bg-[#111] text-white hover:bg-[#222]">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 md:grid-cols-[1.45fr_0.85fr] md:px-8">
        <section className="surface-card relative overflow-hidden p-6 md:p-8">
          <div className="absolute right-5 top-5 z-10">
            <Button
              type="button"
              onClick={() => setOpen(true)}
              className="h-10 rounded-full border border-[#e8eaed] bg-white px-4 text-[#111] shadow-sm hover:bg-[#f7f8fa]"
            >
              <Users className="h-4 w-4" />
              Members ({roster.members.length})
            </Button>
          </div>

          <div className="text-xs text-[#9aa0a6]">
            Home <span className="mx-1.5 text-[#c4c7cc]">/</span> Biome
          </div>

          <div
            className={cn(
              "mt-6 overflow-hidden rounded-xl border border-[#eceff3] bg-gradient-to-br",
              theme.wash,
            )}
          >
            <div className="relative flex aspect-[16/9] items-center justify-center">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(17,17,17,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(17,17,17,0.04) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
              <div className="relative grid grid-cols-4 gap-2 p-8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-12 w-12 rounded-lg border border-white/80 shadow-sm md:h-14 md:w-14",
                      theme.tile,
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <h1 className="mt-7 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {roster.biome.name}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#5f6368]">
            {roster.biome.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#e8eaed] bg-[#f7f8fa] px-3 py-1 text-xs font-medium text-[#5f6368]">
              {roster.biome.themeKey}
            </span>
            <span className="rounded-full border border-[#e8eaed] bg-[#f7f8fa] px-3 py-1 text-xs font-medium text-[#5f6368]">
              {roster.members.length} members
            </span>
            <span className="rounded-full border border-[#e8eaed] bg-[#f7f8fa] px-3 py-1 text-xs font-medium text-[#5f6368]">
              3D biome soon
            </span>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <div className="text-sm font-semibold">Biome info</div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#9aa0a6]">Group</dt>
                <dd className="font-medium">{roster.group?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#9aa0a6]">Code</dt>
                <dd className="font-mono tracking-widest text-[#3b82f6]">
                  {roster.group?.code ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#9aa0a6]">Theme</dt>
                <dd className="font-medium capitalize">{roster.biome.themeKey}</dd>
              </div>
            </dl>
          </div>

          <div className="surface-card p-5">
            <div className="mb-3 text-sm font-semibold">Members</div>
            <div className="grid grid-cols-2 gap-2">
              {roster.members.slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-[#e8eaed] bg-[#f7f8fa] px-3 py-3 text-xs font-medium text-[#111]"
                >
                  {m.officialName}
                </div>
              ))}
              {roster.members.length === 0 ? (
                <div className="col-span-2 py-6 text-center text-sm text-[#9aa0a6]">
                  No one else here yet.
                </div>
              ) : null}
            </div>
            {roster.members.length > 8 ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-3 text-sm text-[#3b82f6] hover:underline"
              >
                View all {roster.members.length}
              </button>
            ) : null}
          </div>
        </aside>
      </main>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close members"
              className="fixed inset-0 z-40 bg-black/20"
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
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-[#e8eaed] bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[#e8eaed] px-5 py-4">
                <div>
                  <div className="text-sm font-semibold">Biome members</div>
                  <div className="text-xs text-[#9aa0a6]">{roster.biome.name}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ul className="flex-1 space-y-1 overflow-y-auto p-3">
                {roster.members.map((m) => (
                  <li key={m.id} className="rounded-xl px-3 py-3 text-sm hover:bg-[#f7f8fa]">
                    {m.officialName}
                  </li>
                ))}
              </ul>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
