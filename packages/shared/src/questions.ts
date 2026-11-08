/**
 * The fixed Unify questionnaire. Option ids are stable (they're stored with answers),
 * labels are what students see and what Gemini reads when writing a profile.
 */

export type ChoiceQuestion = {
  id: string;
  kind: "choice";
  prompt: string;
  /** Short name for this dimension, used in prompts and fallback profiles. */
  topic: string;
  options: Array<{ id: string; label: string }>;
};

export type TextQuestion = {
  id: string;
  kind: "text";
  prompt: string;
  topic: string;
  placeholder: string;
  required: boolean;
  maxLength: number;
};

export type Question = ChoiceQuestion | TextQuestion;

/** questionId → option id (choice) or free text (text). */
export type QuizAnswers = Record<string, string>;

export const QUESTIONS: Question[] = [
  {
    id: "start",
    kind: "choice",
    topic: "starting work",
    prompt: "In group work, when do you usually start on your projects?",
    options: [
      { id: "right_away", label: "Right away" },
      { id: "getting_ahead", label: "I like getting ahead" },
      { id: "few_days", label: "Within the first few days" },
      { id: "week_before", label: "About a week before it's due" },
      { id: "last_minute", label: "The last day or two" },
    ],
  },
  {
    id: "investment",
    kind: "choice",
    topic: "investment in group work",
    prompt: "How would you describe the priority of this group project in your schedule right now?",
    options: [
      { id: "priority", label: "This is one of my main commitments right now" },
      { id: "balanced", label: "I care about doing well, but I'm balancing several other commitments" },
      { id: "my_part", label: "I plan to complete my responsibilities and contribute consistently" },
      { id: "low", label: "I'm primarily focused on meeting the project requirements" },
    ],
  },
  {
    id: "communication",
    kind: "choice",
    topic: "communication",
    prompt: "What is your preferred way of communicating with your group?",
    options: [
      { id: "constant", label: "Frequent messages throughout the day" },
      { id: "weekly_update", label: "A message update once a week" },
      { id: "calls", label: "Group calls" },
      { id: "in_person", label: "In-person meetings" },
    ],
  },
  {
    id: "meetings",
    kind: "choice",
    topic: "meeting frequency",
    prompt: "How often should the group meet?",
    options: [
      { id: "often", label: "Several times a week" },
      { id: "weekly", label: "Once a week" },
      { id: "rarely", label: "As little as possible" },
    ],
  },
  {
    id: "schedule",
    kind: "choice",
    topic: "when they work",
    prompt: "When do you usually get your best work done?",
    options: [
      { id: "morning", label: "Mornings" },
      { id: "daytime", label: "Afternoons" },
      { id: "evening", label: "Evenings" },
      { id: "late_night", label: "Late at night" },
    ],
  },
  {
    id: "role",
    kind: "choice",
    topic: "usual role",
    prompt: "What role do you naturally end up taking in a group?",
    options: [
      { id: "leader", label: "Leader" },
      { id: "organizer", label: "Organizer" },
      { id: "ideas", label: "Ideas person" },
      { id: "writer", label: "Writer" },
      { id: "designer", label: "Designer" },
      { id: "flexible", label: "Whatever the group needs" },
    ],
  },
  {
    id: "expectations",
    kind: "choice",
    topic: "expectations of teammates",
    prompt: "What do you expect most from your teammates?",
    options: [
      { id: "high_bar", label: "High-quality work and an equal distribution of tasks" },
      { id: "flexible_open", label: "Being flexible and open to new ideas" },
      { id: "responsive", label: "Being responsive to messages" },
      { id: "done", label: "I don't mind, I'm not picky" },
    ],
  },
  {
    id: "ideal",
    kind: "text",
    topic: "ideal group experience",
    prompt: "Describe your ideal group project experience in 1 to 2 sentences.",
    placeholder: "e.g. Divide and conquer strategy, weekly check-ins, no last-minute work.",
    required: false,
    maxLength: 400,
  },
  {
    id: "notes",
    kind: "text",
    topic: "other notes",
    prompt:
      "Is there anything you'd like your teammates to know about you, your working style, or how you prefer to collaborate?",
    placeholder: "Schedule constraints, strengths, pet peeves…",
    required: false,
    maxLength: 400,
  },
];

export const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

/** Returns an error message for the first invalid or missing answer, or null if all good. */
export function validateAnswers(answers: QuizAnswers): string | null {
  for (const q of QUESTIONS) {
    const value = answers[q.id];
    if (q.kind === "choice") {
      if (!value) return `Please answer: ${q.prompt}`;
      if (!q.options.some((o) => o.id === value)) return `Invalid answer for: ${q.prompt}`;
    } else {
      const text = (value ?? "").trim();
      if (q.required && !text) return `Please answer: ${q.prompt}`;
      if (text.length > q.maxLength) return `Answer is too long: ${q.prompt}`;
    }
  }
  return null;
}

/** Turns answers into "Q: … / A: …" lines, the shared input for Gemini and fallbacks. */
export function describeAnswers(answers: QuizAnswers) {
  const lines: string[] = [];
  for (const q of QUESTIONS) {
    const value = answers[q.id];
    if (q.kind === "choice") {
      const option = q.options.find((o) => o.id === value);
      if (option) lines.push(`Q (${q.topic}): ${q.prompt}\nA: ${option.label}`);
    } else if (value?.trim()) {
      lines.push(`Q (${q.topic}): ${q.prompt}\nA: ${value.trim()}`);
    }
  }
  return lines.join("\n\n");
}
