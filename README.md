# Mutual

UBC classroom group-project matching. Students join with a shared code, answer a short working-style quiz, get embedded into a vector, and land in a biome with classmates who work similarly.

No signup, no Google login, no chat — cookie session + quiz + biomes only.

## Stack

- Next.js App Router · TypeScript · Tailwind CSS · Framer Motion
- Neon PostgreSQL + pgvector · Drizzle ORM
- Gemini embeddings · TanStack Query · Zod

## Quick start

```bash
cp .env.example .env.local
# set DATABASE_URL + GEMINI_API_KEY

npm install
npx tsx scripts/push-group-schema.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. `/create-group` — name, description, code, edit quiz questions  
2. `/` — classmates enter code + official name  
3. `/quiz` — answer questions → vector match  
4. `/biome/[id]` — biome placeholder + Members list  

Full system notes: [EXPLANATION.md](./EXPLANATION.md)

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_EMBEDDING_MODEL` | Default `gemini-embedding-001` |
| `GEMINI_EMBEDDING_DIMENSIONS` | Default `768` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally |
