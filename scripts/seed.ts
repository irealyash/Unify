/**
 * Development-only seed for Mutual.
 * Never run against production.
 *
 * Usage:
 *   1. Set DATABASE_URL and GEMINI_API_KEY in .env.local
 *   2. Enable pgvector and push schema: npm run db:push
 *   3. npm run seed
 *
 * Reset (destructive):
 *   TRUNCATE users CASCADE; then re-run seed.
 */
import "dotenv/config";
import { config } from "dotenv";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { embedText, getEmbeddingModel, vectorToSqlLiteral } from "../src/lib/embeddings";

config({ path: ".env.local" });

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
  console.error("Refusing to seed in production. Set ALLOW_PROD_SEED=true to override.");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required to generate real embeddings");
  process.exit(1);
}

const db = drizzle(neon(DATABASE_URL), { schema });

type SeedPersona = {
  username: string;
  displayName: string;
  selfText: string;
  seekingText: string;
  interests: string[];
  skills: string[];
  isUbcStudentClaim: boolean;
  isUbcVerified: boolean;
};

const personas: SeedPersona[] = [
  {
    username: "aria_chen",
    displayName: "Aria Chen",
    selfText:
      "Second-year CS student at UBC. Introverted but warm once I know people. I love building AI products, reading design essays, and long walks. Strengths: systems thinking and writing. Weaknesses: I overthink shipping. Values curiosity, honesty, and craft.",
    seekingText:
      "Looking for ambitious builders who care about product taste. Prefer collaborators who enjoy deep technical conversations, startups, and shipping small experiments together. Complementary design or ML skills are a plus.",
    interests: ["AI", "design", "startups"],
    skills: ["TypeScript", "Python", "product"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "noah_patel",
    displayName: "Noah Patel",
    selfText:
      "Entrepreneurial CS student. Extroverted, competitive, and energetic. I run a small campus club, hack on fintech ideas, and love debating strategy. Strengths: momentum and networking. Weakness: impatience with slow process.",
    seekingText:
      "Want people who are intensely ambitious about startups and finance. Prefer high-agency operators who move fast, pitch boldly, and want to co-found or co-build.",
    interests: ["startups", "finance", "networking"],
    skills: ["sales", "React", "fundraising"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "maya_okonkwo",
    displayName: "Maya Okonkwo",
    selfText:
      "Robotics and mechatronics enthusiast. Calm, methodical, and hands-on. I spend nights in the makerspace building robots and reading papers on control systems. Values precision, patience, and shared curiosity.",
    seekingText:
      "Looking for people into robotics, hardware, and AI perception. Want collaborators for competitions and research who enjoy debugging physical systems and learning together.",
    interests: ["robotics", "hardware", "research"],
    skills: ["C++", "ROS", "electronics"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "leo_martinez",
    displayName: "Leo Martinez",
    selfText:
      "Full-stack engineer who loves beautiful interfaces. Balanced personality—social in small groups. Background in psychology and CS. I care about accessibility, clean architecture, and teaching juniors.",
    seekingText:
      "Want thoughtful product people and designers who obsess over UX details. Prefer calm collaboration, mentorship energy, and long-term projects over hackathon chaos.",
    interests: ["UX", "accessibility", "mentorship"],
    skills: ["Next.js", "design systems", "teaching"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "sofia_nguyen",
    displayName: "Sofia Nguyen",
    selfText:
      "Data scientist with a love for storytelling. Empathetic, organized, and quietly ambitious. I work on climate analytics and enjoy ceramics on weekends. Strengths: clarity and empathy. Weakness: saying yes too often.",
    seekingText:
      "Looking for climate-minded technologists and researchers. Want people who combine quantitative rigor with social impact and enjoy interdisciplinary conversation.",
    interests: ["climate", "data", "ceramics"],
    skills: ["SQL", "Python", "visualization"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "ethan_brooks",
    displayName: "Ethan Brooks",
    selfText:
      "Competitive programmer turned systems engineer. Introverted, intense focus, dry humor. I enjoy distributed systems, chess, and trail running. Values competence and directness.",
    seekingText:
      "Want peers who geek out on systems, performance, and hard algorithms. Prefer low-drama collaborators who respect deep work and can spar intellectually.",
    interests: ["systems", "chess", "running"],
    skills: ["Go", "Rust", "distributed systems"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "priya_raman",
    displayName: "Priya Raman",
    selfText:
      "Product designer studying HCI. Warm, reflective, and collaborative. I sketch constantly, facilitate workshops, and care about inclusive research. Strengths: listening and synthesis.",
    seekingText:
      "Looking for engineers and founders who respect design process. Want to partner with builders who iterate carefully and care about users, not just shipping features.",
    interests: ["HCI", "research", "facilitation"],
    skills: ["Figma", "prototyping", "user research"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "jackson_lee",
    displayName: "Jackson Lee",
    selfText:
      "ML researcher focused on multimodal models. Curious, slightly chaotic, night owl. I publish papers, tinker with GPUs, and cook elaborate meals. Values intellectual honesty.",
    seekingText:
      "Want ambitious AI researchers and builders. Prefer people who read papers, challenge ideas kindly, and want to turn research into useful products.",
    interests: ["ML research", "cooking", "papers"],
    skills: ["PyTorch", "math", "experimentation"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "amelia_ross",
    displayName: "Amelia Ross",
    selfText:
      "Community builder and event organizer. Extroverted, optimistic, and organized. Studying commerce with a minor in CS. I host dinners, run meetups, and love connecting people.",
    seekingText:
      "Looking for founders and creatives who want to grow communities. Prefer people who show up consistently, collaborate generously, and enjoy hosting or speaking.",
    interests: ["community", "events", "commerce"],
    skills: ["organizing", "public speaking", "ops"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "kai_tanaka",
    displayName: "Kai Tanaka",
    selfText:
      "Indie game developer. Quiet, imaginative, and stubborn about polish. I ship small games, write music, and care deeply about player emotion. Weakness: perfectionism.",
    seekingText:
      "Want artists, composers, and playful engineers. Prefer collaborators who love games as craft and are comfortable iterating on feel, not just features.",
    interests: ["games", "music", "narrative"],
    skills: ["Unity", "pixel art", "sound"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "nina_volkov",
    displayName: "Nina Volkov",
    selfText:
      "Security-minded backend engineer. Skeptical, precise, and loyal. Background in math. I enjoy threat modeling, open-source, and cold-water swimming. Values integrity.",
    seekingText:
      "Looking for builders who take security and reliability seriously. Prefer teammates who document well, think adversarially, and enjoy deep backend work.",
    interests: ["security", "oss", "swimming"],
    skills: ["Postgres", "auth", "Go"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "omar_haddad",
    displayName: "Omar Haddad",
    selfText:
      "Biotech + CS double interest. Analytical, patient, and mission-driven. I work in a wet lab during the day and code analysis pipelines at night. Values scientific rigor.",
    seekingText:
      "Want people at the intersection of biology and software. Prefer collaborators interested in computational biology, healthtech, and careful experimentation.",
    interests: ["biotech", "health", "pipelines"],
    skills: ["R", "Python", "lab protocols"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "elena_park",
    displayName: "Elena Park",
    selfText:
      "Front-end craftsperson. Aesthetic, detail-obsessed, and collaborative. I love motion design, typography, and thoughtful micro-interactions. Studying visual arts + CS.",
    seekingText:
      "Looking for product engineers who care about craft. Prefer people who notice spacing, timing, and brand—and want to build delightful interfaces together.",
    interests: ["motion", "typography", "brand"],
    skills: ["CSS", "Framer Motion", "illustration"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "dylan_okoro",
    displayName: "Dylan Okoro",
    selfText:
      "Growth-minded marketer who codes a little. Charismatic, experimental, and data-curious. I run campus campaigns and build landing pages. Strengths: storytelling and iteration.",
    seekingText:
      "Want technical co-founders and product people. Prefer builders who appreciate go-to-market thinking and want to test ideas with real users quickly.",
    interests: ["growth", "storytelling", "experiments"],
    skills: ["copy", "analytics", "no-code"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "hana_suzuki",
    displayName: "Hana Suzuki",
    selfText:
      "Quiet researcher in NLP. Thoughtful, careful with words, and deeply curious about language. I enjoy poetry, tea ceremonies, and reproducible experiments.",
    seekingText:
      "Looking for other NLP/ML people and writers. Prefer calm collaborators who enjoy reading papers, debating evaluation, and building language tools.",
    interests: ["NLP", "poetry", "tea"],
    skills: ["transformers", "evaluation", "writing"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "caleb_wright",
    displayName: "Caleb Wright",
    selfText:
      "DevOps and platform engineer. Practical, steady, and helpful. I automate everything, mentor juniors, and hike on weekends. Values reliability over hype.",
    seekingText:
      "Want product teams that need strong platform support. Prefer people who respect infrastructure, observability, and sustainable engineering practices.",
    interests: ["devops", "hiking", "mentorship"],
    skills: ["Kubernetes", "CI/CD", "Terraform"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "zara_ahmed",
    displayName: "Zara Ahmed",
    selfText:
      "Social entrepreneur. Bold, empathetic, and restless. Studying political science and CS. I build civic tech prototypes and organize volunteer drives.",
    seekingText:
      "Looking for engineers and designers who care about civic impact. Prefer collaborators who want to ship tools for communities, not just consumer novelty.",
    interests: ["civic tech", "policy", "volunteering"],
    skills: ["organizing", "prototyping", "research"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "ben_foster",
    displayName: "Ben Foster",
    selfText:
      "Music producer and audio engineer who codes DSP tools. Night-owl creative with disciplined practice. Values originality and craftsmanship.",
    seekingText:
      "Want creative technologists into audio, generative music, and interactive installations. Prefer playful collaborators who finish projects.",
    interests: ["music", "DSP", "installations"],
    skills: ["Ableton", "C++", "Max/MSP"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "isabella_cruz",
    displayName: "Isabella Cruz",
    selfText:
      "Pre-med with a CS minor. Empathetic, structured, and ambitious about health equity. I volunteer in clinics and build small triage tools.",
    seekingText:
      "Looking for healthtech builders and clinicians-in-training. Prefer people who balance empathy with technical excellence and want patient-centered products.",
    interests: ["health equity", "clinics", "triage tools"],
    skills: ["research", "React", "communication"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "ryan_kim",
    displayName: "Ryan Kim",
    selfText:
      "Quant-curious CS student. Competitive, analytical, and sports-obsessed. I trade paper portfolios, study probability, and play intramural basketball.",
    seekingText:
      "Want people into markets, probability, and building trading/analytics tools. Prefer sharp, competitive collaborators who still share knowledge freely.",
    interests: ["markets", "probability", "basketball"],
    skills: ["Python", "statistics", "Excel"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "lila_moreau",
    displayName: "Lila Moreau",
    selfText:
      "Philosophy + CS student. Reflective, witty, and slow to judge. I write essays on ethics of AI and host reading circles. Strengths: framing hard questions.",
    seekingText:
      "Looking for thoughtful technologists who care about ethics and meaning. Prefer deep conversation partners over purely transactional networking.",
    interests: ["ethics", "essays", "reading circles"],
    skills: ["writing", "facilitation", "critical thinking"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "marcus_reid",
    displayName: "Marcus Reid",
    selfText:
      "Mobile engineer shipping consumer apps. Pragmatic, friendly, and deadline-driven. I skateboard, take photos, and obsess over app store polish.",
    seekingText:
      "Want designers and growth people to ship consumer products. Prefer collaborators who move fast, test with users, and care about retention details.",
    interests: ["mobile", "photography", "skating"],
    skills: ["Swift", "Kotlin", "product sense"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "aisha_benali",
    displayName: "Aisha Benali",
    selfText:
      "Climate engineer focused on energy systems. Grounded, collaborative, and optimistic. I model grid data and volunteer for local sustainability projects.",
    seekingText:
      "Looking for data scientists and policy-minded builders. Prefer people who want measurable climate impact and enjoy interdisciplinary teamwork.",
    interests: ["energy", "sustainability", "modeling"],
    skills: ["MATLAB", "Python", "systems modeling"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "tom_ng",
    displayName: "Tom Ng",
    selfText:
      "Database nerd and educator. Patient teacher, dry humor, loves puzzles. I write SQL guides and contribute to open-source ORMs.",
    seekingText:
      "Want learners and builders who care about data modeling. Prefer collaborators who ask good questions and enjoy teaching as much as coding.",
    interests: ["databases", "teaching", "puzzles"],
    skills: ["SQL", "Postgres", "documentation"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "grace_holloway",
    displayName: "Grace Holloway",
    selfText:
      "AR/VR experimenter. Playful, visually oriented, and socially curious. I prototype spatial interfaces and host demo nights.",
    seekingText:
      "Looking for 3D artists and interaction designers. Prefer people excited about immersive media who can ship prototypes, not just concept decks.",
    interests: ["AR/VR", "spatial", "demo nights"],
    skills: ["Unity", "Blender", "interaction design"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "samir_khan",
    displayName: "Samir Khan",
    selfText:
      "Backend + infra for AI products. Calm under pressure, systematic, and kind. I optimize inference stacks and enjoy long-form tech blogs.",
    seekingText:
      "Want AI product builders who need strong infra partners. Prefer ambitious teams that value reliability, cost awareness, and clear communication.",
    interests: ["inference", "infra", "writing"],
    skills: ["CUDA basics", "Python", "observability"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "julia_santos",
    displayName: "Julia Santos",
    selfText:
      "Journalism student who codes scrapers. Curious, courageous, and deadline-tough. I investigate local stories and build small news tools.",
    seekingText:
      "Looking for civic technologists and designers. Prefer collaborators who care about truth, public interest, and usable information tools.",
    interests: ["journalism", "civic tools", "investigations"],
    skills: ["scraping", "writing", "research"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "felix_bauer",
    displayName: "Felix Bauer",
    selfText:
      "Hardware hacker and EE student. Hands-on, stubborn, and generous with tools. I build sensors, drones, and teach soldering workshops.",
    seekingText:
      "Want robotics and IoT collaborators. Prefer makers who enjoy physical prototyping and aren't afraid of messy first versions.",
    interests: ["electronics", "drones", "workshops"],
    skills: ["PCB", "firmware", "soldering"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "nora_ellis",
    displayName: "Nora Ellis",
    selfText:
      "Therapist-in-training exploring digital mental health. Empathic, boundaries-aware, and thoughtful about ethics. I journal, hike, and prototype supportive chat experiences carefully.",
    seekingText:
      "Looking for responsible product builders in mental health. Prefer people who prioritize safety, research evidence, and human dignity over growth hacks.",
    interests: ["mental health", "ethics", "hiking"],
    skills: ["listening", "research", "prototyping"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "victor_huang",
    displayName: "Victor Huang",
    selfText:
      "Compiler enthusiast and language nerd. Introverted, precise, and endlessly curious. I contribute to open-source parsers and teach office hours.",
    seekingText:
      "Want peers who love programming languages, compilers, and formal methods. Prefer deep technical friendships over networking events.",
    interests: ["compilers", "languages", "teaching"],
    skills: ["Rust", "LLVM", "theory"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "chloe_bennett",
    displayName: "Chloe Bennett",
    selfText:
      "Fashion-tech experimenter. Expressive, social, and visually bold. I sew, code wearables, and care about sustainable materials.",
    seekingText:
      "Looking for creative engineers and material scientists. Prefer collaborators who want to blend craft, technology, and sustainability.",
    interests: ["fashion tech", "wearables", "sustainability"],
    skills: ["sewing", "Arduino", "brand"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "andre_silva",
    displayName: "Andre Silva",
    selfText:
      "Sports analytics builder. Competitive, team-oriented, and numbers-first. I model soccer data and coach youth teams on weekends.",
    seekingText:
      "Want data people and product builders who love sports. Prefer collaborators who enjoy visualizations, storytelling with data, and friendly competition.",
    interests: ["sports", "analytics", "coaching"],
    skills: ["Python", "stats", "dashboards"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "mei_lin",
    displayName: "Mei Lin",
    selfText:
      "Education technologist. Warm, structured, and patient. I build learning tools for first-gen students and facilitate study groups.",
    seekingText:
      "Looking for engineers and designers passionate about education equity. Prefer collaborators who listen to learners and iterate based on feedback.",
    interests: ["edtech", "equity", "facilitation"],
    skills: ["curriculum", "React", "user interviews"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "owen_clarke",
    displayName: "Owen Clarke",
    selfText:
      "3D graphics engineer. Quiet craftsperson with a love for light and simulation. I contribute to open-source renderers and climb indoors.",
    seekingText:
      "Want graphics and game-engine peers. Prefer people who enjoy math-heavy creative engineering and long collaborative projects.",
    interests: ["graphics", "rendering", "climbing"],
    skills: ["C++", "shaders", "math"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "tara_joshi",
    displayName: "Tara Joshi",
    selfText:
      "Product ops and budding PM. Organized, diplomatic, and systems-minded. I turn chaos into roadmaps and care about team health.",
    seekingText:
      "Looking for technical founders who need a structured product partner. Prefer builders who communicate clearly and value process without bureaucracy.",
    interests: ["product", "ops", "team health"],
    skills: ["roadmapping", "facilitation", "analytics"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "isaac_moore",
    displayName: "Isaac Moore",
    selfText:
      "Open-source maintainer and docs obsessive. Humble, consistent, and community-first. I triage issues, write guides, and mentor new contributors.",
    seekingText:
      "Want collaborators who care about maintainership and developer experience. Prefer people who write good docs and respond kindly in public forums.",
    interests: ["oss", "docs", "dx"],
    skills: ["TypeScript", "technical writing", "community"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "yuki_mori",
    displayName: "Yuki Mori",
    selfText:
      "Computational neuroscience student. Soft-spoken, intense curiosity, loves puzzles of the mind. I analyze neural data and sketch diagrams constantly.",
    seekingText:
      "Looking for interdisciplinary scientists and ML people. Prefer collaborators who enjoy bridging biology, computation, and careful interpretation.",
    interests: ["neuroscience", "ML", "diagrams"],
    skills: ["MATLAB", "stats", "experiment design"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
  {
    username: "parker_james",
    displayName: "Parker James",
    selfText:
      "Sales engineer for campus startups. Extroverted, practical, and quick on my feet. I translate technical products into customer stories.",
    seekingText:
      "Want technical founders who need go-to-market help. Prefer teams building real B2B tools who value customer conversations as much as code.",
    interests: ["sales", "B2B", "storytelling"],
    skills: ["demos", "negotiation", "CRM"],
    isUbcStudentClaim: true,
    isUbcVerified: false,
  },
  {
    username: "sienna_blake",
    displayName: "Sienna Blake",
    selfText:
      "Photographer and creative technologist. Observant, independent, and visually poetic. I build generative art tools and exhibit work locally.",
    seekingText:
      "Looking for artists and engineers who blend code with galleries. Prefer collaborators who finish exhibitions and care about aesthetic intention.",
    interests: ["photography", "generative art", "exhibitions"],
    skills: ["Processing", "lightroom", "installation"],
    isUbcStudentClaim: false,
    isUbcVerified: false,
  },
  {
    username: "dev_anand",
    displayName: "Dev Anand",
    selfText:
      "Full-stack startup generalist. High energy, adaptable, and shipping-obsessed. I've built three campus products and love customer interviews.",
    seekingText:
      "Want complementary co-founders: strong designers or deep ML partners. Prefer ambitious people who want to build a company, not just a portfolio piece.",
    interests: ["startups", "customer interviews", "shipping"],
    skills: ["Next.js", "Postgres", "GTM"],
    isUbcStudentClaim: true,
    isUbcVerified: true,
  },
];

async function main() {
  console.log(`Seeding ${personas.length} synthetic users with real embeddings...`);
  const model = getEmbeddingModel();

  // Clear previous seed users (clerk ids starting with seed_)
  await db.execute(sql`
    DELETE FROM users WHERE clerk_user_id LIKE 'seed_%'
  `);

  let i = 0;
  for (const persona of personas) {
    i += 1;
    const userId = randomUUID();
    const clerkUserId = `seed_${persona.username}`;
    const publicSummary = persona.selfText.slice(0, 220);

    console.log(`[${i}/${personas.length}] embedding ${persona.username}...`);
    const [selfEmbedding, seekingEmbedding] = await Promise.all([
      embedText(persona.selfText),
      embedText(persona.seekingText),
    ]);

    await db.insert(schema.users).values({
      id: userId,
      clerkUserId,
      username: persona.username,
      usernameNormalized: persona.username.toLowerCase(),
      displayName: persona.displayName,
      avatarUrl: `https://api.dicebear.com/9.x/thumbs/svg?seed=${persona.username}`,
      interests: persona.interests,
      skills: persona.skills,
      isUbcStudentClaim: persona.isUbcStudentClaim,
      isUbcVerified: persona.isUbcVerified,
    });

    await db.insert(schema.userProfiles).values({
      userId,
      selfText: persona.selfText,
      seekingText: persona.seekingText,
      publicSummary,
      embeddingModel: model,
      selfVersion: 1,
      seekingVersion: 1,
      profileVersion: 1,
      onboardingCompletedAt: new Date(),
    });

    const selfLit = vectorToSqlLiteral(selfEmbedding);
    const seekingLit = vectorToSqlLiteral(seekingEmbedding);
    await db.execute(sql`
      UPDATE user_profiles
      SET
        self_embedding = ${selfLit}::vector,
        seeking_embedding = ${seekingLit}::vector,
        updated_at = NOW()
      WHERE user_id = ${userId}::uuid
    `);

    await db.insert(schema.profileVersions).values([
      {
        userId,
        assistantType: "self",
        profileText: persona.selfText,
        version: 1,
      },
      {
        userId,
        assistantType: "seeking",
        profileText: persona.seekingText,
        version: 1,
      },
    ]);
  }

  console.log("Seed complete.");
  console.log("Reset procedure: DELETE FROM users WHERE clerk_user_id LIKE 'seed_%'; then re-run npm run seed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
