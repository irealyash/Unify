"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, officialName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not join group");

      if (data.participant?.biomeId && data.participant?.quizCompletedAt) {
        router.push(`/biome/${data.participant.biomeId}`);
      } else {
        router.push("/quiz");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07140f] text-[#e8f5e9]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(74,222,128,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(34,197,94,0.12), transparent 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 20%, black 20%, transparent 75%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400 font-display text-sm font-bold text-[#07140f]">
            M
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Mutual</span>
        </Link>
        <Link
          href="/create-group"
          className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/20"
        >
          Create group
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            UBC group project matching
          </motion.div>

          <h1 className="font-display text-[clamp(2.75rem,10vw,4.25rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
            Mutual
          </h1>
          <p className="mt-4 max-w-md text-balance text-base text-emerald-100/60">
            Enter the shared class code, answer a short working-style quiz, and get
            paired into a biome with classmates who work like you.
          </p>

          <form onSubmit={onJoin} className="mt-10 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-emerald-100/80">
                Group code
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. CPSC310"
                className="border-emerald-400/20 bg-black/30 font-mono tracking-[0.2em] text-emerald-50 placeholder:text-emerald-100/30"
                required
                minLength={4}
                maxLength={12}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-emerald-100/80">
                Official name
              </Label>
              <Input
                id="name"
                value={officialName}
                onChange={(e) => setOfficialName(e.target.value)}
                placeholder="Name as on your class roster"
                className="border-emerald-400/20 bg-black/30 text-emerald-50 placeholder:text-emerald-100/30"
                required
                minLength={2}
                maxLength={120}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-emerald-400 text-[#07140f] hover:bg-emerald-300"
            >
              {loading ? "Joining…" : "Join pool"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
