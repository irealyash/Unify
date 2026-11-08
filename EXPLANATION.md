# Mutual — System Explanation

Mutual pairs UBC classmates for group projects by working style. Students **sign in with Google (Auth0)**, join a shared group code, answer a quiz once, and land in a biome. Identical question sets reuse saved answers so the quiz can be skipped.

---

## 1. What Mutual is

1. Sign in with **Google only** via Auth0.
2. Create a **group** at `/create-group` (name, description, unique code, customizable quiz) — or join an existing one.
3. Enter the **group code** + **official name**.
4. Answer **multiple-choice** working-style questions + optional free-write — **or skip** if you’ve already answered an identical question set.
5. Answers become `working_style_text` → Gemini embedding → nearest **biome** by cosine similarity.
6. Land on `/biome/[id]` with a Members list.

No chat, friends, or discovery feeds.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| App framework | Next.js App Router (TypeScript) |
| UI | React, Tailwind, Framer Motion, light “Toolradar-style” cards |
| Auth | Auth0 (`@auth0/nextjs-auth0`) — Google connection only |
| Database | Neon PostgreSQL + pgvector |
| ORM | Drizzle |
| Embeddings | Gemini `gemini-embedding-001` (768-d) |
| Validation | Zod |

---

## 3. Auth0 (Google only)

### Env vars

| Variable | Purpose |
|---|---|
| `AUTH0_DOMAIN` | Tenant domain, e.g. `your-tenant.us.auth0.com` (no `https://`) |
| `AUTH0_CLIENT_ID` | Regular Web Application client id |
| `AUTH0_CLIENT_SECRET` | Client secret |
| `AUTH0_SECRET` | Cookie encryption secret (`openssl rand -hex 32`) |
| `APP_BASE_URL` | e.g. `http://localhost:3000` |

### Dashboard checklist

1. Create a **Regular Web Application**.
2. Allowed Callback URLs: `http://localhost:3000/auth/callback`
3. Allowed Logout URLs: `http://localhost:3000`
4. Allowed Web Origins: `http://localhost:3000`
5. Authentication → Social → enable **Google**
6. Prefer disabling other DB connections for a Google-only experience

SDK mounts `/auth/login`, `/auth/logout`, `/auth/callback` via `src/proxy.ts`.  
Login links use `?connection=google-oauth2` so users go straight to Google.

App user rows live in `users` (`auth0_sub`, email, name, picture).

---

## 4. Quiz reuse (same questions → skip)

When a user finishes a quiz, Mutual stores a **`user_answer_profiles`** row:

| Field | Role |
|---|---|
| `fingerprint` | SHA-256 of normalized prompts + types + option **labels** |
| `answers` | JSON of prompt → selected label / free text |
| `working_style_text` + `embedding` | Reused for biome assignment |

On join:

1. Fingerprint the group’s current questions.
2. If the signed-in user has a profile with that fingerprint, map labels → this group’s option IDs, copy the embedding, assign a biome, set `reused_answers = true`, and **skip `/quiz`**.
3. If questions differ (or no profile), send them through the quiz; submit upserts the profile for next time.

Option IDs can differ across groups; matching is by **prompt + option label**.

---

## 5. Product flow

```
Google Auth0 sign-in
       ↓
/create-group  →  POST /api/groups
       ↓
share code
       ↓
/  (code + official name)  →  POST /api/groups/join
       ↓
same fingerprint? ──yes──→ /biome/[id]
       ↓ no
/quiz  →  POST /api/quiz/submit  →  save profile + biome
       ↓
/biome/[id]
```

### Routes

| Path | Purpose |
|---|---|
| `/` | Join with code + official name (requires Google) |
| `/create-group` | Create group + edit questions |
| `/quiz` | Answer questions (skipped when reusable) |
| `/biome/[id]` | Biome placeholder + members |
| `/auth/login` | Auth0 Google login |
| `/auth/logout` | Log out |

### APIs

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/me` | optional | Current app user |
| `POST` | `/api/groups` | required | Create group |
| `GET` | `/api/groups/[code]` | — | Fetch group |
| `POST` | `/api/groups/join` | required | Join; maybe skip quiz |
| `GET` | `/api/session` | cookie | Participant + questions |
| `POST` | `/api/quiz/submit` | required | Save answers + profile + biome |
| `GET` | `/api/biomes/[id]` | — | Roster |

---

## 6. Database

Schema: `src/lib/db/schema.ts` · push: `npm run db:push`

| Table | Role |
|---|---|
| `users` | Auth0 identity |
| `groups` | Code, name, description |
| `group_questions` | Per-group quiz |
| `biomes` | Centroids + themes |
| `participants` | Per user×group join, embedding, biome |
| `participant_answers` | Answers for this group attempt |
| `user_answer_profiles` | Durable answers by question fingerprint |

---

## 7. UI

Light gray canvas (`#f7f8fa`), white bordered cards, black pill CTAs, soft blue links — inspired by clean SaaS directory layouts. Shared `SiteHeader` with Google sign-in / avatar + Create group.

---

## 8. Local setup

```bash
npm install
cp .env.example .env.local
# fill DATABASE_URL, GEMINI_API_KEY, Auth0 vars
npm run db:push
npm run dev
```

1. Sign in with Google  
2. Create a group and copy the code  
3. Join (second account or same) — first time takes the quiz; joining another group with the **same questions** skips to the biome  

---

## 9. Upcoming

- Real Minecraft-like 3D biomes  
- Team formation tools inside a biome  
- Post-create question editing for group creators  
