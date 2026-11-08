import type { QuestionOption } from "@/lib/db/schema";

export type DefaultQuestion = {
  prompt: string;
  questionType: "multiple_choice" | "free_text";
  options: QuestionOption[];
  required: boolean;
};

export type DefaultBiome = {
  name: string;
  description: string;
  styleSummary: string;
  themeKey: string;
};

function opts(
  items: Array<[string, string, string]>,
): QuestionOption[] {
  return items.map(([id, label, embeddingHint]) => ({ id, label, embeddingHint }));
}

export const DEFAULT_QUESTIONS: DefaultQuestion[] = [
  {
    prompt: "How often do you want group meetings for this project?",
    questionType: "multiple_choice",
    required: true,
    options: opts([
      ["meet_daily", "Almost daily / several times a week", "Prefers frequent meetings and constant sync."],
      ["meet_weekly", "About once a week", "Prefers a steady weekly meeting cadence."],
      ["meet_sparingly", "Only when needed", "Prefers sparse meetings and async updates."],
      ["meet_minimal", "As few as possible", "Prefers minimal meetings and independent work."],
    ]),
  },
  {
    prompt: "How much do you tend to procrastinate on coursework?",
    questionType: "multiple_choice",
    required: true,
    options: opts([
      ["proc_low", "Rarely — I start early", "Starts early, low procrastination, plans ahead."],
      ["proc_mid", "Sometimes — I need a light push", "Moderate pace with occasional delay."],
      ["proc_high", "Often — I work best near deadlines", "Works in bursts near deadlines, high urgency energy."],
      ["proc_extreme", "Almost always last-minute", "Last-minute sprinter who thrives under pressure."],
    ]),
  },
  {
    prompt: "Preferred way to split project work?",
    questionType: "multiple_choice",
    required: true,
    options: opts([
      ["split_together", "Work together on most things", "Collaborative co-working style, pair often."],
      ["split_hybrid", "Mix of together + individual tasks", "Balanced hybrid collaboration style."],
      ["split_roles", "Clear roles, then assemble", "Role-based division with structured ownership."],
      ["split_solo", "Mostly individual, merge at the end", "Independent contributor, async assembly."],
    ]),
  },
  {
    prompt: "How do you prefer to communicate with teammates?",
    questionType: "multiple_choice",
    required: true,
    options: opts([
      ["comm_chat", "Quick chat / Discord / iMessage", "Fast informal chat communication."],
      ["comm_async", "Async messages / docs", "Async written communication and documentation."],
      ["comm_calls", "Voice / video calls", "Prefers calls for clarity and discussion."],
      ["comm_mix", "Whatever the group agrees", "Flexible communicator, adapts to the group."],
    ]),
  },
  {
    prompt: "In a group project, what role do you naturally take?",
    questionType: "multiple_choice",
    required: true,
    options: opts([
      ["role_lead", "Organizer / coordinator", "Natural organizer who tracks tasks and deadlines."],
      ["role_builder", "Builder / implementer", "Hands-on builder focused on shipping work."],
      ["role_ideas", "Ideas / research", "Idea generator and researcher."],
      ["role_polish", "Editor / quality checker", "Polishes quality, reviews, and finishes details."],
    ]),
  },
  {
    prompt: "How do you feel about deadlines?",
    questionType: "multiple_choice",
    required: true,
    options: opts([
      ["dead_buffer", "Finish early with buffer time", "Wants early completion and safety buffer."],
      ["dead_ontime", "Hit the deadline cleanly", "Reliable on-time finisher."],
      ["dead_flex", "Flexible if quality needs more time", "Flexible on timing if quality requires it."],
      ["dead_crunch", "Crunch at the end is fine", "Comfortable with end crunch and late intensity."],
    ]),
  },
  {
    prompt: "Anything else about your working style for this group project?",
    questionType: "free_text",
    required: false,
    options: [],
  },
];

export const DEFAULT_BIOMES: DefaultBiome[] = [
  {
    name: "Forest Focus",
    description: "Steady planners who start early and protect focus time.",
    themeKey: "forest",
    styleSummary:
      "Working style: starts early, low procrastination, prefers planned weekly meetings, reliable deadlines with buffer, structured and calm collaboration.",
  },
  {
    name: "Canyon Sprint",
    description: "High-energy deadline sprinters who move fast under pressure.",
    themeKey: "canyon",
    styleSummary:
      "Working style: last-minute energy, thrives near deadlines, burst productivity, fewer meetings, high urgency, crunch-friendly.",
  },
  {
    name: "Meadow Collab",
    description: "People who want frequent syncs and work side-by-side.",
    themeKey: "meadow",
    styleSummary:
      "Working style: frequent meetings, collaborative co-working, chatty communication, shared ownership, enjoys working together often.",
  },
  {
    name: "Summit Solo",
    description: "Independent builders who prefer async and clear ownership.",
    themeKey: "summit",
    styleSummary:
      "Working style: independent tasks, async communication, minimal meetings, clear personal ownership, merges work later.",
  },
  {
    name: "River Flow",
    description: "Flexible adapters who balance structure with improvisation.",
    themeKey: "river",
    styleSummary:
      "Working style: flexible cadence, hybrid collaboration, adaptable communication, moderate planning, comfortable adjusting process.",
  },
  {
    name: "Forge Builders",
    description: "Role-driven makers who organize work into clear parts.",
    themeKey: "forge",
    styleSummary:
      "Working style: role-based division, implementation focused, organized coordination, practical shipping mindset, structured assembly.",
  },
];

export function normalizeGroupCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function generateGroupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
