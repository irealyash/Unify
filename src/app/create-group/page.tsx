"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  blankMcq,
  QuestionEditor,
  type EditableQuestion,
} from "@/components/groups/question-editor";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_QUESTIONS } from "@/lib/groups/defaults";

function defaultsToEditable(): EditableQuestion[] {
  return DEFAULT_QUESTIONS.map((q) => ({
    key: `q_${Math.random().toString(36).slice(2, 9)}`,
    prompt: q.prompt,
    questionType: q.questionType,
    options: q.options.map((o) => ({ ...o })),
    required: q.required,
  }));
}

export default function CreateGroupPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [questions, setQuestions] = useState<EditableQuestion[]>(defaultsToEditable);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetch("/api/me").then((r) => r.json());
      if (cancelled) return;
      if (!data.user) {
        window.location.href = `/auth/login?connection=google-oauth2&returnTo=${encodeURIComponent("/create-group")}`;
        return;
      }
      setAuthed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(
    () => name.trim().length >= 2 && questions.length > 0,
    [name, questions],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const normalizedQuestions = questions.map((q) => {
        if (!q.prompt.trim()) throw new Error("Every question needs a prompt");
        if (q.questionType === "multiple_choice") {
          if (q.options.length < 2) throw new Error("MCQs need at least 2 choices");
          return {
            prompt: q.prompt.trim(),
            questionType: q.questionType,
            required: q.required,
            options: q.options.map((o) => {
              if (!o.label.trim()) throw new Error("Fill every choice label");
              return {
                ...o,
                label: o.label.trim(),
                embeddingHint: o.embeddingHint.trim() || o.label.trim(),
              };
            }),
          };
        }
        return {
          prompt: q.prompt.trim(),
          questionType: q.questionType,
          required: q.required,
          options: q.options,
        };
      });

      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          code: code.trim() || undefined,
          questions: normalizedQuestions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create group");

      setCreatedCode(data.group.code);
      toast.success(`Group created — code ${data.group.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <SiteHeader />
        <div className="py-32 text-center text-sm text-[#9aa0a6]">Checking Google sign-in…</div>
      </div>
    );
  }

  if (createdCode) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-5 py-16 md:px-8">
          <div className="surface-card p-8 text-center">
            <div className="text-xs uppercase tracking-[0.18em] text-[#9aa0a6]">Group ready</div>
            <h1 className="mt-3 font-display text-3xl font-semibold">Share this code</h1>
            <p className="mt-3 text-sm text-[#5f6368]">
              Classmates sign in with Google, enter the code, and join the same matching pool.
            </p>
            <div className="mt-8 rounded-2xl border border-[#eceff3] bg-[#f7f8fa] px-6 py-8">
              <div className="font-mono text-4xl font-semibold tracking-[0.28em] text-[#111]">
                {createdCode}
              </div>
              <p className="mt-3 text-sm text-[#5f6368]">{name}</p>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => router.push("/")}
                className="h-10 rounded-full bg-[#111] px-5 text-white hover:bg-[#222]"
              >
                Go to join page
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-full"
                onClick={() => {
                  setCreatedCode(null);
                  setName("");
                  setDescription("");
                  setCode("");
                  setQuestions(defaultsToEditable());
                }}
              >
                Create another
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        <div className="mb-6 text-xs text-[#9aa0a6]">
          Home <span className="mx-1.5 text-[#c4c7cc]">/</span> Create group
        </div>
        <div className="surface-card p-6 md:p-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Create a group</h1>
          <p className="mt-2 text-sm text-[#5f6368]">
            Make a unique code, customize the quiz, and share it with your UBC class.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-8">
            <section className="space-y-4 rounded-2xl border border-[#eceff3] bg-[#fafbfc] p-5">
              <div className="space-y-2">
                <Label htmlFor="name">Group name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="CPSC 310 Project Teams"
                  className="h-11 rounded-xl border-[#e8eaed] bg-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional context for classmates joining this pool"
                  className="rounded-xl border-[#e8eaed] bg-white"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Custom code (optional)</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Leave blank to auto-generate"
                  maxLength={12}
                  className="h-11 rounded-xl border-[#e8eaed] bg-white font-mono tracking-widest"
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">Quiz questions</h2>
                  <p className="mt-1 text-sm text-[#5f6368]">
                    Edit, remove, or add questions. Identical sets let classmates reuse prior answers.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setQuestions([blankMcq()])}
                >
                  Clear defaults
                </Button>
              </div>
              <QuestionEditor questions={questions} onChange={setQuestions} />
            </section>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={!canSubmit || loading}
                className="h-11 rounded-full bg-[#111] px-6 text-white hover:bg-[#222]"
              >
                {loading ? "Creating biomes…" : "Create group"}
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full">
                <Link href="/">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
