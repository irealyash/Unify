import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QUESTIONS, validateAnswers, type QuizAnswers } from "@unify/shared";
import { request } from "@/lib/socket";
import { cn } from "@/lib/utils";

const draftKey = (code: string) => `unify:draft:${code}`;

function loadDraft(code: string): QuizAnswers {
  try {
    return JSON.parse(localStorage.getItem(draftKey(code)) ?? "{}") as QuizAnswers;
  } catch {
    return {};
  }
}

function saveDraft(code: string, answers: QuizAnswers | null) {
  try {
    if (answers) localStorage.setItem(draftKey(code), JSON.stringify(answers));
    else localStorage.removeItem(draftKey(code));
  } catch {
    // Storage blocked: the draft just won't survive a refresh.
  }
}

/** One-question-at-a-time questionnaire shown over the lobby while the quiz is open. */
export function QuizPanel({ code, retry }: { code: string; retry?: boolean }) {
  const [answers, setAnswers] = useState<QuizAnswers>(() => loadDraft(code));
  const [step, setStep] = useState(() => {
    const first = QUESTIONS.findIndex((q) => q.kind === "choice" && !loadDraft(code)[q.id]);
    return first === -1 ? 0 : first;
  });
  const [submitting, setSubmitting] = useState(false);
  const advanceTimer = useRef<number | undefined>(undefined);

  useEffect(() => saveDraft(code, answers), [code, answers]);
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const question = QUESTIONS[step]!;
  const isLast = step === QUESTIONS.length - 1;
  const value = answers[question.id] ?? "";
  const canContinue = question.kind === "text" ? !question.required || value.trim() : value;

  const setAnswer = (id: string, next: string) => setAnswers((a) => ({ ...a, [id]: next }));
  const goTo = (next: number) => {
    window.clearTimeout(advanceTimer.current);
    setStep(Math.max(0, Math.min(QUESTIONS.length - 1, next)));
  };

  function choose(optionId: string) {
    setAnswer(question.id, optionId);
    // Kahoot-style: picking an option moves on after a beat.
    if (!isLast) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => setStep((s) => s + 1), 280);
    }
  }

  async function submit() {
    const problem = validateAnswers(answers);
    if (problem) {
      const missing = QUESTIONS.findIndex((q) => q.kind === "choice" && !answers[q.id]);
      if (missing !== -1) goTo(missing);
      toast.error(problem);
      return;
    }
    setSubmitting(true);
    try {
      await request("quiz:submit", answers);
      saveDraft(code, null);
      toast.success("Answers in! Hang tight for the sort.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl rounded-2xl border border-[#e3e5ea] bg-white p-6 text-[#0f1222] shadow-[0_24px_60px_-24px_rgba(15,18,34,0.35)] sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4 text-sm text-[#6b7080]">
          <span>
            Question {step + 1} of {QUESTIONS.length}
          </span>
          {retry ? <span className="text-[#c2410c]">Something went wrong, please submit again</span> : null}
        </div>
        <div className="mb-7 h-1.5 overflow-hidden rounded-full bg-[#eef0f4]">
          <div
            className="h-full rounded-full bg-[#5b5ce2] transition-all duration-300"
            style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
          />
        </div>

        <h2 className="text-balance text-xl font-semibold leading-snug sm:text-2xl">
          {question.prompt}
        </h2>

        <div className="mt-6">
          {question.kind === "choice" ? (
            <div className="grid gap-2.5">
              {question.options.map((option) => {
                const selected = value === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => choose(option.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition",
                      selected
                        ? "border-[#5b5ce2] bg-[#5b5ce2]/8 font-medium"
                        : "border-[#e3e5ea] hover:border-[#c9ccd6] hover:bg-[#f7f8fa]",
                    )}
                  >
                    {option.label}
                    {selected ? <Check className="h-4 w-4 shrink-0 text-[#5b5ce2]" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <textarea
                value={value}
                onChange={(e) => setAnswer(question.id, e.target.value)}
                placeholder={question.placeholder}
                maxLength={question.maxLength}
                rows={4}
                autoFocus
                className="w-full resize-none rounded-xl border border-[#e3e5ea] px-4 py-3 text-[15px] outline-none transition placeholder:text-[#a0a4b3] focus:border-[#5b5ce2]"
              />
              <div className="mt-1.5 flex justify-between text-xs text-[#8a8fa0]">
                <span>{question.required ? "Required" : "Optional"}</span>
                <span>
                  {value.length}/{question.maxLength}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-7 flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[#6b7080] transition hover:text-[#0f1222] disabled:invisible"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-[#5b5ce2] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#4c4dd0] disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit answers"}
              <Check className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              disabled={!canContinue}
              className="flex items-center gap-2 rounded-xl bg-[#0f1222] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#262a40] disabled:opacity-40"
            >
              {question.kind === "text" && !value.trim() ? "Skip" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
