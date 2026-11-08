"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FeatureStrip } from "@/components/landing/feature-strip";
import { HeroSection } from "@/components/landing/hero-section";
import { Navbar } from "@/components/layout/navbar";

type MeUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string;
};

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();
        if (cancelled) return;
        setUser(data.user ?? null);
        if (data.user?.name) setOfficialName((prev) => prev || data.user.name);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function validate() {
    let ok = true;
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 4 || normalized.length > 12) {
      setCodeError("Enter a join code between 4 and 12 characters.");
      ok = false;
    } else if (!/^[A-Z0-9]+$/.test(normalized)) {
      setCodeError("Codes can only include letters and numbers.");
      ok = false;
    } else {
      setCodeError(null);
    }

    if (officialName.trim().length < 2) {
      setNameError("Enter your official name as it appears on the roster.");
      ok = false;
    } else {
      setNameError(null);
    }
    return ok;
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      window.location.href = `/auth/login?connection=google-oauth2&returnTo=${encodeURIComponent("/")}`;
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, officialName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not join group");

      if (data.skippedQuiz && (data.biomeId || data.participant?.biomeId)) {
        if (data.reusedAnswers) {
          toast.success("Same quiz as before — heading to your biome");
        }
        router.push(`/biome/${data.biomeId || data.participant.biomeId}`);
      } else if (data.participant?.biomeId && data.participant?.quizCompletedAt) {
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
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground">
      <Navbar user={user} loading={user === undefined} />
      <main className="flex min-h-0 flex-1 flex-col">
        <HeroSection
          user={user}
          code={code}
          officialName={officialName}
          loading={loading}
          codeError={codeError}
          nameError={nameError}
          onCodeChange={(value) => {
            setCode(value);
            if (codeError) setCodeError(null);
          }}
          onNameChange={(value) => {
            setOfficialName(value);
            if (nameError) setNameError(null);
          }}
          onSubmit={onJoin}
        />
        <FeatureStrip />
      </main>
    </div>
  );
}
