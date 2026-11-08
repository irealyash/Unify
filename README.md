# Mutual

UBC classroom group-project matching. Sign in with **Google (Auth0)**, join a shared code, answer a working-style quiz once, and land in a biome with classmates who work similarly. Identical quizzes reuse saved answers.

## Stack

- Next.js App Router · TypeScript · Tailwind CSS · Framer Motion
- Auth0 (Google only) · Neon PostgreSQL + pgvector · Drizzle ORM
- Gemini embeddings · TanStack Query · Zod

## Quick start

```bash
cp .env.example .env.local
# set DATABASE_URL, GEMINI_API_KEY, and Auth0 vars

npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Sign in with Google  
2. `/create-group` — name, description, code, edit quiz  
3. `/` — classmates enter code + official name  
4. Quiz once → biome (skipped when questions match a prior save)  

Full notes: [EXPLANATION.md](./EXPLANATION.md)

## Auth0

Regular Web App with Google social connection enabled.

| Variable | Example |
|---|---|
| `AUTH0_DOMAIN` | `your-tenant.us.auth0.com` |
| `AUTH0_CLIENT_ID` | from Auth0 app |
| `AUTH0_CLIENT_SECRET` | from Auth0 app |
| `AUTH0_SECRET` | `openssl rand -hex 32` |
| `APP_BASE_URL` | `http://localhost:3000` |

Callbacks: `{APP_BASE_URL}/auth/callback` · Logout / Web Origin: `{APP_BASE_URL}`
