"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  blankMcq,
  QuestionEditor,
  type EditableQuestion,
} from "@/components/groups/question-editor";
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [questions, setQuestions] = useState<EditableQuestion[]>(defaultsToEditable);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const canSubmit = useMemo(() => name.trim().length >= 2 && questions.length > 0, [name, questions]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      for (const q of questions) {
        if (!q.prompt.trim()) throw new Error("Every question needs a prompt");
        if (q.questionType === "multiple_choice") {
          if (q.options.length < 2) throw new Error("MCQs need at least 2 choices");
          for (const o of q.options) {
            if (!o.label.trim()) throw new Error("Fill every choice label");
            if (!o.embeddingHint.trim()) {
              o.embeddingHint = o.label.trim();
            }
          }
        }
      }

      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          code: code.trim() || undefined,
          questions: questions.map((q) => ({
            prompt: q.prompt.trim(),
            questionType: q.questionType,
            options: q.options,
            required: q.required,
          })),
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

  if (createdCode) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Group ready</h1>
        <p className="mt-3 text-muted-foreground">
          Share this code with your class. Everyone who joins enters the same matching pool.
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Group code
          </div>
          <div className="mt-3 font-mono text-4xl font-semibold tracking-[0.25em]">
            {createdCode}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{name}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => router.push("/")}>Go to join page</Button>
          <Button
            variant="outline"
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
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            Create a group
          </h1>
          <p className="mt-2 text-muted-foreground">
            Make a unique code, customize the quiz, and share it with your UBC class.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        <section className="space-y-4 rounded-2xl border border-border bg-card/40 p-5">
          <div className="space-y-2">
            <Label htmlFor="name">Group name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CPSC 310 Project Teams"
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
              className="font-mono tracking-widest"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Quiz questions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit, remove, or add questions. Defaults are tuned for group-project working style.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuestions([blankMcq()])}
            >
              Clear defaults
            </Button>
          </div>
          <QuestionEditor questions={questions} onChange={setQuestions} />
        </section>

        <Button type="submit" disabled={!canSubmit || loading} className="h-11 px-6">
          {loading ? "Creating biomes…" : "Create group"}
        </Button>
      </form>
    </div>
  );
}
