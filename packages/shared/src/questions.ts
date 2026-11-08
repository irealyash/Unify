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
    prompt: "A group project just got assigned. When do you usually start on your part?",
    options: [
      { id: "right_away", label: "Right away, I like getting ahead" },
      { id: "few_days", label: "Within the first few days" },
      { id: "week_before", label: "About a week before it's due" },
      { id: "last_minute", label: "The last day or two, pressure helps me focus" },
    ],
  },
  {
    id: "grade",
    kind: "choice",
    topic: "grade goal",
    prompt: "What grade are you aiming for on this project?",
    options: [
      { id: "top", label: "A+, I want it to be the best in the class" },
      { id: "a_range", label: "A solid A" },
      { id: "b_range", label: "A B is fine" },
      { id: "pass", label: "Honestly, just a pass" },
    ],
  },
  {
    id: "investment",
    kind: "choice",
    topic: "investment in group work",
    prompt: "How much does this group project matter to you right now?",
    options: [
      { id: "priority", label: "It's a top priority this term" },
      { id: "balanced", label: "I care, but I'm balancing a lot of other things" },
      { id: "my_part", label: "I'll do my part well, nothing extra" },
      { id: "low", label: "Not much, I just need to get through it" },
    ],
  },
  {
    id: "communication",
    kind: "choice",
    topic: "communication",
    prompt: "How do you like to keep in touch with your group?",
    options: [
      { id: "constant", label: "Active group chat, messaging throughout the day" },
      { id: "async", label: "Quick updates a few times a week" },
      { id: "calls", label: "Scheduled calls or in-person meetups" },
      { id: "minimal", label: "Only when something actually needs deciding" },
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
      { id: "milestones", label: "Just around big milestones" },
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
      { id: "daytime", label: "Afternoons, between classes" },
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
      { id: "leader", label: "Organizer: I set the plan and keep people on track" },
      { id: "builder", label: "Builder: I do a big chunk of the hands-on work" },
      { id: "ideas", label: "Ideas person: research, brainstorming, direction" },
      { id: "polisher", label: "Finisher: editing, checking, making it polished" },
      { id: "flexible", label: "Whatever the group needs" },
    ],
  },
  {
    id: "expectations",
    kind: "choice",
    topic: "expectations of teammates",
    prompt: "What do you expect most from your teammates?",
    options: [
      { id: "high_bar", label: "High-quality work and everyone pulling equal weight" },
      { id: "reliable", label: "Doing what they said, when they said" },
      { id: "chill", label: "Being easygoing and flexible" },
      { id: "done", label: "Just get it done, I'm not picky" },
    ],
  },
  {
    id: "ideal",
    kind: "text",
    topic: "ideal group experience",
    prompt: "Describe your ideal group project experience in a sentence or two.",
    placeholder: "e.g. Clear roles from day one, a weekly check-in, no last-minute panic.",
    required: false,
    maxLength: 400,
  },
  {
    id: "notes",
    kind: "text",
    topic: "other notes",
    prompt: "Anything your future teammates should know about how you work?",
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

/** A student's answers in readable form, in question order, skipping anything left blank. */
export function readableAnswers(answers: QuizAnswers) {
  const out: Array<{ id: string; topic: string; answer: string }> = [];
  for (const q of QUESTIONS) {
    const value = answers[q.id]?.trim();
    if (!value) continue;
    const answer = q.kind === "choice" ? q.options.find((o) => o.id === value)?.label : value;
    if (answer) out.push({ id: q.id, topic: q.topic, answer });
  }
  return out;
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
