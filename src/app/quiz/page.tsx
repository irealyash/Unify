"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading quiz…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Change code
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Working style quiz
        </h1>
        <p className="mt-2 text-muted-foreground">
          {session.participant.officialName} · {session.group.name}{" "}
          <span className="font-mono text-xs tracking-widest">({session.group.code})</span>
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        {session.questions.map((q, index) => (
          <fieldset key={q.id} className="space-y-3 rounded-2xl border border-border p-5">
            <legend className="px-1 text-sm font-medium">
              {index + 1}. {q.prompt}
              {q.required ? "" : " (optional)"}
            </legend>

            {q.questionType === "multiple_choice" ? (
              <div className="grid gap-2">
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
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-foreground/40 hover:bg-muted/50",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={q.id}>Your notes</Label>
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
                  placeholder="Schedules, strengths, anything teammates should know…"
                />
              </div>
            )}
          </fieldset>
        ))}

        <Button type="submit" disabled={submitting} className="h-11 w-full sm:w-auto sm:px-8">
          {submitting ? "Matching into a biome…" : "Find my biome"}
        </Button>
      </form>
    </div>
  );
}
