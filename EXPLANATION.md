# Mutual — System Explanation

This document explains how Mutual works end-to-end: database, API keys, embeddings, discovery lists, AI profile assistants, auth, messaging, and UBC verification.

---

## 1. What Mutual is

Mutual is a reciprocal people-discovery app built around two questions:

1. **Who are you?** → stored as `self_text`, embedded as `self_embedding` (`V_self`)
2. **Who are you looking for?** → stored as `seeking_text`, embedded as `seeking_embedding` (`V_seeking`)

Matching is **not** tag-based. Scores come from **real vector similarity** between those embeddings. LLMs never invent match percentages.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| App framework | Next.js App Router (TypeScript) |
| UI | React, Tailwind CSS, Framer Motion, Radix/shadcn-style components |
| Auth | Clerk (Google OAuth only) |
| Database | Neon PostgreSQL + **pgvector** |
| ORM | Drizzle |
| AI embeddings + chat | Google Gemini (`@google/genai`) |
| Realtime | Ably (token-auth from server) |
| Client data | TanStack Query + Zustand |
| Validation | Zod |
| Hosting target | Vercel |

---

## 3. Where the database is

- **Provider:** [Neon](https://console.neon.tech)
- **Connection:** `DATABASE_URL` in `.env.local`
- **Vector extension:** `CREATE EXTENSION IF NOT EXISTS vector;`
- **Schema source of truth:** `src/lib/db/schema.ts`
- **SQL migration:** `drizzle/0001_init.sql`
- **Client:** `src/lib/db/index.ts` (Neon HTTP + Drizzle)

### Important: embeddings are NOT on `users`

Identity lives on **`users`**.  
Profile text + vectors live on **`user_profiles`**.

| Table | Role |
|---|---|
| `users` | Clerk link, username, avatar, UBC claim/verified flags |
| `user_profiles` | `self_text`, `seeking_text`, `public_summary`, **`self_embedding`**, **`seeking_embedding`**, versions |
| `profile_versions` | Undo history for self/seeking text |
| `profile_assistant_messages` | Separate chat histories for the two AI assistants |
| `friendships` | Friend request graph (canonical low/high user ids) |
| `conversations` / `messages` | Chat after friendship accepted |
| `notifications` | Persistent in-app notifications |
| `ubc_verifications` | Private education email verification records |
| `blocked_users` | Blocks (excluded from discovery) |

### Embedding columns (the ones you look for)

In Neon → table **`user_profiles`**:

| Column | Meaning |
|---|---|
| `self_embedding` | `vector(768)` for “who you are” |
| `seeking_embedding` | `vector(768)` for “who you’re looking for” |
| `embedding_model` | e.g. `gemini-embedding-001` |
| `self_text` / `seeking_text` | Source natural-language profiles |
| `self_version` / `seeking_version` | Optimistic concurrency + undo |

---

## 4. API keys / environment variables

Copy `.env.example` → `.env.local`. Never commit real secrets.

| Variable | Service | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | Browser auth |
| `CLERK_SECRET_KEY` | Clerk | Server auth (must be full key) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk | Webhook verification |
| `DATABASE_URL` | Neon | Postgres connection |
| `GEMINI_API_KEY` | Google AI Studio | Embeddings + assistant chat |
| `GEMINI_EMBEDDING_MODEL` | Gemini | Default `gemini-embedding-001` |
| `GEMINI_CHAT_MODEL` | Gemini | Default `gemini-2.0-flash` |
| `GEMINI_EMBEDDING_DIMENSIONS` | Gemini | Default `768` (must match DB vector size) |
| `ABLY_API_KEY` | Ably | Server-side realtime publish + token minting |
| `NEXT_PUBLIC_APP_URL` | App | Base URL |
| `UBC_VERIFIED_EMAIL_DOMAINS` | App | Allowlist, default `student.ubc.ca` |
| `DISCOVERY_PAGE_SIZE` | App | Default `20` |

### Where to get credentials

- Clerk: https://dashboard.clerk.com → API Keys (enable **Google only**)
- Neon: https://console.neon.tech → Connection string
- Gemini: https://aistudio.google.com/apikey
- Ably: https://ably.com/dashboard → API Keys

---

## 5. Authentication & signup flow

1. User hits `/sign-in` → Clerk Google OAuth.
2. After sign-in, redirect to `/onboarding`.
3. `syncClerkBasics()` (`src/lib/auth/current-user.ts`) **synchronously** upserts:
   - a `users` row (`clerk_user_id`, avatar, display name)
   - a `user_profiles` row
4. Clerk webhooks (`/api/webhooks/clerk`) also upsert, but **onboarding does not rely on webhooks alone**.
5. Onboarding `POST /api/profile` saves username + both profile texts, writes version history, generates both embeddings, then unlocks `/discover`.

Username rules: 3–20 chars, letters/numbers/underscore, case-insensitive unique, reserved names blocked, DB unique index on `username_normalized`.

---

## 6. How embeddings are made

Code: `src/lib/embeddings/index.ts` + `src/services/embedding.service.ts`

### Process

1. Take `self_text` or `seeking_text`.
2. Call Gemini `embedContent` with:
   - model: `GEMINI_EMBEDDING_MODEL` (`gemini-embedding-001`)
   - dimensions: `768`
   - task type: semantic similarity
3. Store the float array into pgvector:
   - `user_profiles.self_embedding`
   - `user_profiles.seeking_embedding`
4. Update `embedding_model` so incompatible vectors are never compared.

### When embeddings regenerate

| Event | Regenerates |
|---|---|
| Onboarding complete | Both |
| “About Me” assistant update | `self_embedding` only |
| “My Ideal People” assistant update | `seeking_embedding` only |
| Undo last profile change | The affected side |

Embeddings are **not** regenerated on unrelated UI actions.

---

## 7. How the three discovery lists are made

Code: `src/services/matching.service.ts`  
API: `GET /api/discovery?kind=...&ubc=...&offset=...`  
UI: `src/components/discovery/discovery-page.tsx`

Scores use pgvector cosine distance (`<=>`):

```text
cosine_similarity = 1 - cosine_distance
display_score = clamp(round(similarity * 100), 0, 100)
```

Central conversion: `src/lib/matching/scores.ts`.

### A. People You Might Like (`kind=you_might_like`)

```text
similarity(A.seeking_embedding, B.self_embedding)
```

“Does this person look like who I’m looking for?”

### B. People Who Might Like You (`kind=might_like_you`)

```text
similarity(A.self_embedding, B.seeking_embedding)
```

“Do I look like who they are looking for?”

### C. Mutual Connections (`kind=mutual`)

```text
scoreAB = similarity(A.seeking, B.self)
scoreBA = similarity(B.seeking, A.self)
mutual  = harmonic_mean(scoreAB, scoreBA)
        = 2 * AB * BA / (AB + BA)   # zero-safe
```

Balances one-sided high scores. UI also shows both directional percentages.

### Filters applied in SQL

Every list excludes:

- yourself
- inactive/deleted users
- users without completed onboarding
- users missing required embeddings
- users with a different `embedding_model`
- blocked relationships

### UBC filter dropdown (`ubc=`)

| Value | Label | SQL meaning |
|---|---|---|
| `all` | Everyone | No UBC constraint |
| `ubc_students` | UBC students | `is_ubc_student_claim OR is_ubc_verified` |
| `ubc_verified` | UBC verified | `is_ubc_verified = true` |

Filter applies to **all three lists**.

---

## 8. How the two AI chatboxes update profiles & lists

UI: `src/components/ai/ai-profile-studio.tsx`  
API: `/api/assistant/self` and `/api/assistant/seeking`  
Service: `src/services/assistant.service.ts`

### Two independent assistants

| Assistant | Updates | Chat history |
|---|---|---|
| **About Me** | `self_text` + `self_embedding` only | `assistant_type = 'self'` |
| **My Ideal People** | `seeking_text` + `seeking_embedding` only | `assistant_type = 'seeking'` |

They never cross-edit each other’s profile.

### Message flow

1. User sends a message.
2. Backend loads current profile text + recent conversation for that assistant.
3. Gemini returns structured JSON (`assistant_message`, `should_update`, `updated_profile`, `changes_summary`).
4. If `should_update`:
   - save new text
   - bump version
   - insert `profile_versions` row
   - regenerate **only that side’s** embedding
5. Frontend invalidates discovery queries:
   - About Me update → refresh **Might like you** + **Mutual**
   - Ideal People update → refresh **You might like** + **Mutual**
6. Unaffected list keeps its semantic ranking (no fake score reshuffle).

### Undo

`DELETE /api/assistant/self|seeking` restores the previous version text and regenerates the embedding.

### Safety rules

- Do not invent personal facts.
- Preserve existing content unless the user asks to change it.
- Clarifying questions are allowed without updating.
- Version checks prevent concurrent overwrites.

---

## 9. Friend requests, messaging, notifications

### Friendships

- States: `pending`, `accepted`, `declined`, `blocked`
- Canonical pair ordering (`user_low_id < user_high_id`) prevents duplicates
- Accept creates a `conversations` row
- APIs under `/api/friendships`

### Messaging

- Only after **accepted** friendship
- Persist in Neon first (`messages`)
- Then publish Ably event (best-effort)
- Token endpoint: `/api/ably/token` (never exposes Ably secret to browser)

### Notifications

- Always persisted in `notifications`
- Types: friend request, accept, new message
- Realtime fanout via Ably user channel when available

---

## 10. UBC student verification

Two independent concepts:

1. **Claim:** `users.is_ubc_student_claim` (settings toggle)
2. **Verified:** `users.is_ubc_verified` (server-confirmed)

Verification flow:

1. User enters education email.
2. Server checks domain allowlist (`UBC_VERIFIED_EMAIL_DOMAINS`).
3. Client uses Clerk secondary email + OTP (`createEmailAddress` → `prepareVerification` → `attemptVerification`).
4. Server re-checks Clerk that the email is verified and domain is allowlisted.
5. Only then sets `is_ubc_verified = true`.

Education email is private (never shown on public profiles).

Badges:

- No claim → no badge
- Claim, not verified → muted “UBC · unverified”
- Verified → prominent “UBC verified”

---

## 11. Key API map

| Endpoint | Purpose |
|---|---|
| `GET/POST/PATCH /api/profile` | Load / onboard / update account settings |
| `GET /api/profile/username-availability` | Live username check |
| `GET /api/discovery` | Three lists + UBC filter + pagination |
| `GET/POST/DELETE /api/assistant/self` | About Me chat / undo |
| `GET/POST/DELETE /api/assistant/seeking` | Ideal People chat / undo |
| `GET/POST /api/friendships` | List / send requests |
| `POST /api/friendships/[id]/accept\|decline` | Respond |
| `GET /api/conversations` | Conversation list |
| `GET/POST /api/conversations/[id]/messages` | Load / send messages |
| `GET /api/notifications` | Notification feed |
| `POST /api/notifications/read` | Mark read |
| `POST /api/ubc/verification/start\|verify` | UBC verify flow |
| `GET /api/ably/token` | Secure realtime token |
| `POST /api/webhooks/clerk` | Idempotent user sync |
| `GET /api/users/[username]` | Public profile (no private texts/emails/embeddings) |

---

## 12. Local development

```bash
cp .env.example .env.local
# fill credentials

npm install
# In Neon SQL: CREATE EXTENSION IF NOT EXISTS vector;
npm run db:push
npm run seed          # optional: ~40 synthetic users with real embeddings
npm run dev
```

Seed users use `clerk_user_id` like `seed_*` and can be reset with:

```sql
DELETE FROM users WHERE clerk_user_id LIKE 'seed_%';
```

---

## 13. Privacy rules (what is never returned)

APIs must not expose to other users:

- private emails / UBC education emails
- raw private questionnaire text (except to the owner)
- assistant chat histories of others
- private messages of others
- embedding arrays
- API secrets

Public cards show: username, display name, avatar, public summary, interests/skills, UBC badge, match scores, friendship state.

---

## 14. Mental model (one diagram)

```text
Google sign-in (Clerk)
        │
        ▼
 users + user_profiles created
        │
        ▼
 Onboarding: self_text + seeking_text
        │
        ▼
 Gemini embeddings → self_embedding / seeking_embedding
        │
        ├──────────────┬────────────────┐
        ▼              ▼                ▼
 You might like   Might like you    Mutual (harmonic mean)
        │
        ▼
 UBC filter (Everyone / Students / Verified)
        │
        ▼
 AI Studio chats refine one side → re-embed → refresh affected lists
```

---

## 15. File map (most important)

```text
src/lib/db/schema.ts              # tables + pgvector columns
src/lib/embeddings/index.ts       # Gemini embedText
src/lib/matching/scores.ts        # score conversion + harmonic mean
src/services/matching.service.ts  # three discovery queries + UBC filter
src/services/assistant.service.ts # two AI assistants
src/services/embedding.service.ts # persist vectors
src/services/profile.service.ts   # onboarding + undo versions
src/components/ai/ai-profile-studio.tsx
src/components/discovery/*        # lists, cards, UBC filter UI
```

If something looks “missing” in Neon, open **`user_profiles`**, not `users`, for the vector columns.
