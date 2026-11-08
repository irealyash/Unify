"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  prompt: string;
  questionType: "multiple_choice" | "free_text";
  options: Array<{ id: string; label: string; embeddingHint: string }>;
  required: boolean;
};

type SessionPayload = {
  participant: {
    id: string;
    officialName: string;
    biomeId: string | null;
    quizCompletedAt: string | null;
  };
  group: { id: string; code: string; name: string; description: string };
  questions: Question[];
  biome: { id: string; name: string } | null;
};

export default function QuizPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<
    Record<string, { selectedOptionId?: string; freeTextAnswer?: string }>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/me").then((r) => r.json());
        if (!me.user) {
          window.location.href = `/auth/login?connection=google-oauth2&returnTo=${encodeURIComponent("/quiz")}`;
          return;
        }

        const res = await fetch("/api/session");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load session");
        if (!data.session) {
          router.replace("/");
          return;
        }
        if (data.session.participant.biomeId && data.session.participant.quizCompletedAt) {
          router.replace(`/biome/${data.session.participant.biomeId}`);
          return;
        }
        if (!cancelled) setSession(data.session);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load quiz");
        router.replace("/");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const progress = useMemo(() => {
    if (!session) return 0;
    const required = session.questions.filter((q) => q.required);
    if (!required.length) return 100;
    const done = required.filter((q) => {
      const a = answers[q.id];
      if (q.questionType === "multiple_choice") return Boolean(a?.selectedOptionId);
      return Boolean(a?.freeTextAnswer?.trim());
    }).length;
    return Math.round((done / required.length) * 100);
  }, [answers, session]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    try {
      for (const q of session.questions) {
        if (!q.required) continue;
        const a = answers[q.id];
        if (q.questionType === "multiple_choice" && !a?.selectedOptionId) {
          throw new Error(`Please answer: ${q.prompt}`);
        }
      }

      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: session.questions.map((q) => ({
            questionId: q.id,
            selectedOptionId: answers[q.id]?.selectedOptionId ?? null,
            freeTextAnswer: answers[q.id]?.freeTextAnswer ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      toast.success(`Matched into ${data.result.biomeName}`);
      router.push(`/biome/${data.result.biomeId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <SiteHeader />
        <div className="flex items-center justify-center py-32 text-sm text-[#9aa0a6]">
          Loading quiz…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 md:grid-cols-[1.45fr_0.85fr] md:px-8">
        <section className="surface-card p-6 md:p-8">
          <div className="text-xs text-[#9aa0a6]">
            Home <span className="mx-1.5 text-[#c4c7cc]">/</span> {session.group.code}{" "}
            <span className="mx-1.5 text-[#c4c7cc]">/</span> Quiz
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
            Working style quiz
          </h1>
          <p className="mt-2 text-sm text-[#5f6368]">
            {session.participant.officialName} · {session.group.name}
          </p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#eceff3]">
            <div
              className="h-full rounded-full bg-[#111] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {session.questions.map((q, index) => (
              <fieldset key={q.id} className="rounded-2xl border border-[#eceff3] bg-[#fafbfc] p-5">
                <legend className="px-1 text-sm font-semibold text-[#111]">
                  {index + 1}. {q.prompt}
                  {!q.required ? (
                    <span className="ml-1 font-normal text-[#9aa0a6]">(optional)</span>
                  ) : null}
                </legend>

                {q.questionType === "multiple_choice" ? (
                  <div className="mt-3 grid gap-2">
                    {q.options.map((opt) => {
                      const selected = answers[q.id]?.selectedOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [q.id]: { selectedOptionId: opt.id },
                            }))
                          }
                          className={cn(
                            "rounded-xl border px-4 py-3 text-left text-sm transition",
                            selected
                              ? "border-[#111] bg-[#111] text-white"
                              : "border-[#e8eaed] bg-white text-[#111] hover:border-[#c4c7cc]",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor={q.id}>Additional notes</Label>
                    <Textarea
                      id={q.id}
                      rows={4}
                      value={answers[q.id]?.freeTextAnswer ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: { freeTextAnswer: e.target.value },
                        }))
                      }
                      className="rounded-xl border-[#e8eaed] bg-white"
                      placeholder="Schedules, strengths, anything teammates should know…"
                    />
                  </div>
                )}
              </fieldset>
            ))}

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-full bg-[#111] px-8 text-white hover:bg-[#222]"
            >
              {submitting ? "Matching into a biome…" : "Find my biome"}
            </Button>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <div className="text-sm font-semibold">Quiz details</div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#9aa0a6]">Group</dt>
                <dd className="font-medium">{session.group.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#9aa0a6]">Code</dt>
                <dd className="font-mono tracking-widest text-[#3b82f6]">
                  {session.group.code}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#9aa0a6]">Questions</dt>
                <dd className="font-medium">{session.questions.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#9aa0a6]">Progress</dt>
                <dd className="font-medium">{progress}%</dd>
              </div>
            </dl>
          </div>
          <div className="surface-card p-5 text-sm text-[#5f6368]">
            Answers are saved to your Google account. If another group uses the same
            questions, Mutual reuses these answers automatically.
            <div className="mt-4">
              <Link href="/" className="text-[#3b82f6] hover:underline">
                ← Change code
              </Link>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
