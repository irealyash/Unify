# Mutual

AI-powered reciprocal people discovery. Every user answers two questions—**who are you?** and **who are you looking for?**—and Mutual matches people using two semantic embeddings and a balanced mutual score.

## Stack

- Next.js App Router · TypeScript · Tailwind CSS · Framer Motion
- Clerk (Google OAuth only) · Neon PostgreSQL + pgvector · Drizzle ORM
- Gemini embeddings + assistants · Ably realtime · TanStack Query · Zustand · Zod

## Quick start

```bash
cp .env.example .env.local
# fill in credentials (see below)

npm install
npm run db:push          # or apply drizzle/0001_init.sql in Neon SQL editor
npm run seed             # optional: 40 synthetic users with real embeddings
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example` for the full list.

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | [Clerk Dashboard → API Keys](https://dashboard.clerk.com) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk → Webhooks → endpoint signing secret |
| `DATABASE_URL` | [Neon Console](https://console.neon.tech) connection string |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_EMBEDDING_MODEL` | Default `gemini-embedding-001` (768 dims) |
| `GEMINI_CHAT_MODEL` | Default `gemini-2.0-flash` |
| `ABLY_API_KEY` | [Ably Dashboard](https://ably.com/dashboard) |
| `UBC_VERIFIED_EMAIL_DOMAINS` | Comma-separated, default `student.ubc.ca` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally |

## Clerk setup

1. Create a Clerk application.
2. Enable **Google** as the only social provider.
3. Disable email/password and other social providers.
4. Set sign-in/up URLs to `/sign-in`.
5. (Optional) Add webhook `user.created` / `user.updated` / `user.deleted` → `https://YOUR_DOMAIN/api/webhooks/clerk`.
6. Onboarding still upserts the app user synchronously—webhooks are not required for first login.

## Neon setup

1. Create a Neon project.
2. In the SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Push schema: `npm run db:push`  
   Or run `drizzle/0001_init.sql` manually.
4. Confirm HNSW indexes exist on `user_profiles.self_embedding` and `seeking_embedding`.

## Gemini setup

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Keep `GEMINI_EMBEDDING_MODEL=gemini-embedding-001` and `GEMINI_EMBEDDING_DIMENSIONS=768` unless you also alter the pgvector column size and regenerate all embeddings.
3. Never compare embeddings from different models/dimensions.

## Ably setup

1. Create an Ably app and copy the **root API key** into `ABLY_API_KEY` (server only).
2. The browser receives short-lived token requests from `GET /api/ably/token`.
3. Clients may only subscribe to `user:{theirId}` and authorized `conversation:{id}` channels.

## Matching model

For users A and B:

- **People you might like:** `similarity(A.seeking, B.self)`
- **People who might like you:** `similarity(A.self, B.seeking)`
- **Mutual:** harmonic mean of both directional similarities

Scores come from pgvector cosine distance (`<=>`), converted centrally in `src/lib/matching/scores.ts`. LLMs never invent match percentages.

## Seed data

```bash
npm run seed
```

Inserts ~40 diverse synthetic users with real embeddings (`clerk_user_id` prefix `seed_`).

Reset:

```sql
DELETE FROM users WHERE clerk_user_id LIKE 'seed_%';
```

Then re-run `npm run seed`. Never seed production.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local development |
| `npm run build` / `npm start` | Production |
| `npm run typecheck` | TypeScript |
| `npm run db:push` | Push Drizzle schema to Neon |
| `npm run db:studio` | Drizzle Studio |
| `npm run seed` | Dev seed |
| `npx tsx src/lib/matching/scores.test.ts` | Score utility checks |

## Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Add all environment variables (use production Clerk/Neon/Ably/Gemini keys).
3. Set `NEXT_PUBLIC_APP_URL` to your production URL.
4. Run migrations / `db:push` against the production Neon database once.
5. Configure Clerk production instance + Google OAuth redirect URLs.
6. Deploy.

## Product routes

- `/` landing · `/sign-in` Google auth · `/onboarding` username + two questions
- `/discover` three discovery lists + AI Profile Studio
- `/friends` · `/messages` · `/notifications` · `/settings` · `/profile/[username]`

## Limitations

- Requires valid Clerk, Neon, Gemini, and Ably credentials to exercise the full product.
- UBC verification uses Clerk’s secondary email custom flow in the client, then server-side confirmation against Clerk + domain allowlist.
- Exact nearest-neighbor search is fine for hackathon-scale data; HNSW indexes are ready for growth.
- Account deletion soft-deactivates via Clerk webhook; expand hard-delete cleanup as needed for compliance.

## License

Private / all rights reserved unless otherwise stated.
