# Mutual — System Explanation

Mutual pairs UBC classmates for group projects by working style. No accounts, no chat, no friend graph — just a shared group code, a short quiz, embeddings, and biome assignment.

---

## 1. What Mutual is now

1. Someone creates a **group** at `/create-group` (name, description, unique code, customizable quiz).
2. Classmates open `/`, type the **group code** + their **official name**, and join that pool.
3. They answer **multiple-choice** working-style questions plus an optional **free-write**.
4. Answers are turned into a **working-style text**, embedded with Gemini, and stored as a vector.
5. Each person is assigned to the nearest **biome** (centroid vector) for that group by cosine similarity.
6. They land on `/biome/[id]` — a placeholder 3D-style world with a **Members** list of everyone in that biome.

There is **no user database**, signup, Google login, messaging, or discovery feeds.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| App framework | Next.js App Router (TypeScript) |
| UI | React, Tailwind CSS, Framer Motion, Radix-style primitives |
| Session | HttpOnly cookie (`mutual_participant`) — no Clerk |
| Database | Neon PostgreSQL + **pgvector** |
| ORM | Drizzle |
| Embeddings | Google Gemini `gemini-embedding-001` (768-d) |
| Validation | Zod |
| Hosting target | Vercel |

---

## 3. Product flow

```
/create-group  →  POST /api/groups  →  group + default questions + biome centroids
       ↓
share code with class
       ↓
/  (code + official name)  →  POST /api/groups/join  →  cookie session
       ↓
/quiz  →  POST /api/quiz/submit  →  embed working style → nearest biome
       ↓
/biome/[id]  →  GET /api/biomes/[id]  →  member roster panel
```

### Routes

| Path | Purpose |
|---|---|
| `/` | Join with group code + official name |
| `/create-group` | Create group, edit/remove/add quiz questions |
| `/quiz` | Answer that group's questions |
| `/biome/[id]` | Biome placeholder + members list (top-right) |

### APIs

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/groups` | Create group (+ optional custom code/questions) |
| `GET` | `/api/groups/[code]` | Fetch group + questions |
| `POST` | `/api/groups/join` | Join pool; set participant cookie |
| `GET` | `/api/session` | Current participant + quiz for cookie |
| `POST` | `/api/quiz/submit` | Save answers, embed, assign biome |
| `GET` | `/api/biomes/[id]` | Biome details + member names |

---

## 4. Database (Neon + pgvector)

Schema source of truth: `src/lib/db/schema.ts`

| Table | Role |
|---|---|
| `groups` | Unique code, name, description |
| `group_questions` | Per-group MCQ / free-text prompts + option JSON |
| `biomes` | Named worlds per group + `centroid_embedding` vector(768) |
| `participants` | Official name, cookie session token, working-style text + embedding, assigned biome |
| `participant_answers` | Selected option / free-text per question |

### Matching fields that matter

On **`participants`**:

| Column | Meaning |
|---|---|
| `working_style_text` | Natural-language blend of MCQ hints + free write |
| `embedding` | `vector(768)` of that text |
| `biome_id` | Assigned biome after quiz |

On **`biomes`**:

| Column | Meaning |
|---|---|
| `style_summary` | Seed text describing that working-style cluster |
| `centroid_embedding` | Embedding of `style_summary` (nearest-neighbor target) |
| `theme_key` | Visual theme for the placeholder biome UI |

Default biomes (created with every group): Forest Focus, Canyon Sprint, Meadow Collab, Summit Solo, River Flow, Forge Builders — see `src/lib/groups/defaults.ts`.

---

## 5. Environment variables

Copy `.env.example` → `.env.local`. Never commit real secrets.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key |
| `GEMINI_EMBEDDING_MODEL` | Optional; default `gemini-embedding-001` |
| `GEMINI_EMBEDDING_DIMENSIONS` | Optional; default `768` |
| `GEMINI_MODEL` | Unused for core matching; kept for future LLM features |

Clerk, Ably, and education-email vars are **no longer required**.

---

## 6. How pairing works

1. **Join** creates a `participants` row tied to a random `session_token` stored in an HttpOnly cookie.
2. Quiz answers + free text are compiled into `working_style_text` (MCQ options contribute their `embeddingHint` phrases).
3. Gemini embeds that text → `participants.embedding`.
4. SQL picks the biome with the smallest cosine distance:

```sql
ORDER BY centroid_embedding <=> participant_embedding
LIMIT 1
```

5. Everyone in the same group who lands on the same biome appears in that biome’s member list (by official name).

Biomes are **not** full project teams yet — they are working-style clusters inside the class pool. Team formation inside a biome can come later.

---

## 7. Creating / editing questions

On `/create-group`:

- Start from **default UBC group-project questions** (meeting cadence, procrastination, work split, communication, role, deadlines, free write).
- **Clear defaults**, delete individual questions, add MCQs or free-write prompts.
- Each MCQ choice has a **label** (shown to students) and an **embedding hint** (blended into the vector text).

Questions are stored per group at create time. Different classes can use different quizzes while still sharing the same biome themes.

---

## 8. Session model (no accounts)

- Cookie name: `mutual_participant`
- Value: UUID `session_token` on `participants`
- Re-joining the same group with the same cookie updates the official name and continues the quiz/biome flow
- No passwords, OAuth, or email verification

---

## 9. What’s intentionally removed

- Clerk Google login / signup
- User profiles, discovery lists, mutual scores between people
- Friends, notifications, Ably chat
- UBC email verification flows
- AI Profile Studio assistants

---

## 10. Local setup

```bash
npm install
cp .env.example .env.local   # fill DATABASE_URL + GEMINI_API_KEY
npm run db:push              # apply schema to Neon
npm run dev
```

1. Open `/create-group`, create a pool, copy the code.
2. Open `/`, enter code + official name.
3. Finish `/quiz` → land in a biome and open **Members**.

---

## 11. Upcoming

- Real Minecraft-like 3D biome scenes per `theme_key`
- Optional tools to refine team sizes inside a biome
- Creator tools to tweak questions after a group already exists
