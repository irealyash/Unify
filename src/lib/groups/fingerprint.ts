import { createHash } from "crypto";
import type { QuestionOption, SavedAnswer } from "@/lib/db/schema";

export type { SavedAnswer };

export type FingerprintQuestion = {
  prompt: string;
  questionType: "multiple_choice" | "free_text";
  options: Array<Pick<QuestionOption, "label">>;
};

/** Stable hash of question content (prompt + type + option labels). Option IDs ignored. */
export function fingerprintQuestions(questions: FingerprintQuestion[]) {
  const normalized = questions.map((q) => ({
    prompt: q.prompt.trim().toLowerCase().replace(/\s+/g, " "),
    type: q.questionType,
    options:
      q.questionType === "multiple_choice"
        ? q.options
            .map((o) => o.label.trim().toLowerCase().replace(/\s+/g, " "))
            .filter(Boolean)
            .sort()
        : [],
  }));

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function buildSavedAnswers(
  questions: Array<{
    id: string;
    prompt: string;
    questionType: "multiple_choice" | "free_text";
    options: QuestionOption[];
  }>,
  answers: Array<{
    questionId: string;
    selectedOptionId?: string | null;
    freeTextAnswer?: string | null;
  }>,
): SavedAnswer[] {
  const map = new Map(answers.map((a) => [a.questionId, a]));
  return questions.map((q) => {
    const answer = map.get(q.id);
    const option = q.options.find((o) => o.id === answer?.selectedOptionId);
    return {
      prompt: q.prompt,
      questionType: q.questionType,
      selectedOptionLabel: option?.label ?? null,
      freeTextAnswer: answer?.freeTextAnswer ?? null,
    };
  });
}

export function mapSavedAnswersToGroup(params: {
  questions: Array<{
    id: string;
    prompt: string;
    questionType: "multiple_choice" | "free_text";
    options: QuestionOption[];
    required: boolean;
  }>;
  saved: SavedAnswer[];
}) {
  const byPrompt = new Map(
    params.saved.map((s) => [
      s.prompt.trim().toLowerCase().replace(/\s+/g, " "),
      s,
    ]),
  );

  const mapped: Array<{
    questionId: string;
    selectedOptionId: string | null;
    freeTextAnswer: string | null;
  }> = [];

  for (const q of params.questions) {
    const key = q.prompt.trim().toLowerCase().replace(/\s+/g, " ");
    const saved = byPrompt.get(key);
    if (!saved) {
      if (q.required && q.questionType === "multiple_choice") return null;
      continue;
    }

    if (q.questionType === "multiple_choice") {
      const label = saved.selectedOptionLabel
        ?.trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      const option = q.options.find(
        (o) => o.label.trim().toLowerCase().replace(/\s+/g, " ") === label,
      );
      if (!option) {
        if (q.required) return null;
        continue;
      }
      mapped.push({
        questionId: q.id,
        selectedOptionId: option.id,
        freeTextAnswer: null,
      });
    } else {
      mapped.push({
        questionId: q.id,
        selectedOptionId: null,
        freeTextAnswer: saved.freeTextAnswer ?? null,
      });
    }
  }

  return mapped;
}
