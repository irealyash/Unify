"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionOption } from "@/lib/db/schema";

export type EditableQuestion = {
  key: string;
  prompt: string;
  questionType: "multiple_choice" | "free_text";
  options: QuestionOption[];
  required: boolean;
};

function optionId() {
  return `opt_${Math.random().toString(36).slice(2, 8)}`;
}

export function blankMcq(): EditableQuestion {
  return {
    key: `q_${Math.random().toString(36).slice(2, 9)}`,
    prompt: "",
    questionType: "multiple_choice",
    required: true,
    options: [
      { id: optionId(), label: "", embeddingHint: "" },
      { id: optionId(), label: "", embeddingHint: "" },
    ],
  };
}

export function blankFreeText(): EditableQuestion {
  return {
    key: `q_${Math.random().toString(36).slice(2, 9)}`,
    prompt: "Anything else about your working style?",
    questionType: "free_text",
    required: false,
    options: [],
  };
}

type Props = {
  questions: EditableQuestion[];
  onChange: (next: EditableQuestion[]) => void;
};

export function QuestionEditor({ questions, onChange }: Props) {
  function update(index: number, patch: Partial<EditableQuestion>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(
    qIndex: number,
    oIndex: number,
    patch: Partial<QuestionOption>,
  ) {
    const q = questions[qIndex]!;
    const options = q.options.map((o, i) => (i === oIndex ? { ...o, ...patch } : o));
    update(qIndex, { options });
  }

  return (
    <div className="space-y-5">
      {questions.map((q, qi) => (
        <div
          key={q.key}
          className="space-y-3 rounded-xl border border-border bg-card/60 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Label>Question {qi + 1}</Label>
              <Textarea
                value={q.prompt}
                onChange={(e) => update(qi, { prompt: e.target.value })}
                rows={2}
                placeholder="Ask about meeting cadence, procrastination, roles…"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(questions.filter((_, i) => i !== qi))}
              aria-label="Remove question"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={q.questionType === "multiple_choice" ? "default" : "outline"}
              onClick={() =>
                update(qi, {
                  questionType: "multiple_choice",
                  required: true,
                  options:
                    q.options.length >= 2
                      ? q.options
                      : [
                          { id: optionId(), label: "", embeddingHint: "" },
                          { id: optionId(), label: "", embeddingHint: "" },
                        ],
                })
              }
            >
              Multiple choice
            </Button>
            <Button
              type="button"
              size="sm"
              variant={q.questionType === "free_text" ? "default" : "outline"}
              onClick={() =>
                update(qi, { questionType: "free_text", required: false, options: [] })
              }
            >
              Free write
            </Button>
          </div>

          {q.questionType === "multiple_choice" && (
            <div className="space-y-3">
              {q.options.map((opt, oi) => (
                <div key={opt.id} className="grid gap-2 md:grid-cols-2">
                  <Input
                    value={opt.label}
                    onChange={(e) =>
                      updateOption(qi, oi, {
                        label: e.target.value,
                        embeddingHint: e.target.value || opt.embeddingHint,
                      })
                    }
                    placeholder={`Choice ${oi + 1} label`}
                  />
                  <div className="flex gap-2">
                    <Input
                      value={opt.embeddingHint}
                      onChange={(e) =>
                        updateOption(qi, oi, { embeddingHint: e.target.value })
                      }
                      placeholder="Embedding hint (working-style phrase)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={q.options.length <= 2}
                      onClick={() =>
                        update(qi, {
                          options: q.options.filter((_, i) => i !== oi),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  update(qi, {
                    options: [
                      ...q.options,
                      { id: optionId(), label: "", embeddingHint: "" },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add choice
              </Button>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onChange([...questions, blankMcq()])}>
          <Plus className="h-4 w-4" />
          Add multiple choice
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...questions, blankFreeText()])}
        >
          <Plus className="h-4 w-4" />
          Add free write
        </Button>
      </div>
    </div>
  );
}
