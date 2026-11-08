# Unify

Sort a class (or any group) into teams based on how people actually work.

Students join a shared 3D room with a code, Kahoot-style, answer a short working-style
questionnaire, and get sorted into themed 3D **biomes**. Inside a biome they can walk
around and click teammates to see how they match.

- **Problem:** random or self-picked groups often go badly: mismatched commitment, one
  person carrying everyone, clashing schedules and work habits.
- **Users:** teachers and TAs forming project groups, club leads, workshop hosts,
  hackathon organizers.
- **What's different:** groups come from working style and expectations, and sorting is a
  fun, visual experience instead of a spreadsheet.

## Room flow

The server owns each room's stage and moves everyone forward together.

1. **Lobby:** students enter the code and walk around an empty 3D room (WASD), seeing each
   other live.
2. **Quiz:** the host starts it; everyone answers on screen.
3. **Sorting:** a short animation while the server assigns biomes.
4. **Biomes:** each student is moved into their biome with their group.

## Build phases

| Phase | Status | What it delivers |
|---|---|---|
| 0. Scaffold | ✅ | Monorepo: Vite + R3F web app, Node + Socket.IO server, shared types |
| 1. Empty room | ✅ | Host creates a room; students join with code + name and walk around together in real time |
| 2. Quiz | ✅ | Host starts the quiz; answers → Gemini profile → embedding, stored in Postgres + pgvector |
| 3. Sorting | ✅ | Vector match (calibrated per room) + LLM fallback + balancing; sorting animation; players moved into separate rooms |
| 4. Biomes | ⏳ | Night City and Highlands scenes; click a teammate for a cached AI match summary |
| 5. Polish | ⏳ | Host's final-groups view, deploy, optional Auth0 host login |

## Stack

| Part | Tech |
|---|---|
| Web (`apps/web`) | React 19, Vite, react-three-fiber + drei, Tailwind CSS 4, zustand, socket.io-client |
| Server (`apps/server`) | Node + TypeScript (run with `tsx`), Socket.IO, Zod |
| Shared (`packages/shared`) | Socket event types, stage enum, room constants, used by both sides |
| AI | Gemini (`gemini-3.5-flash`, falls back to `-lite`) for profiles; `gemini-embedding-001` (768-d) for vectors |
| Database | Postgres + pgvector on Tiger Data, via `postgres` (postgres.js) |

## Getting started

Requires Node 22+.

```bash
npm install
cp .env.example .env   # fill in GEMINI_API_KEY and DATABASE_URL
npm run db:setup       # enables pgvector and creates tables (safe to re-run)
npm run dev            # server on :3001, web on :5173
```

Without `DATABASE_URL` the app still runs; it just doesn't persist anything. Without
`GEMINI_API_KEY`, profiles fall back to a plain template and embeddings fail (status `error`).

Open <http://localhost:5173/host> and create a room. Then open
<http://localhost:5173> in another browser (or a private window: tabs in the same
browser share a player session) and join with the code.

### Playing together (other computers)

Campus Wi-Fi usually blocks laptops from reaching each other, so share your dev server
through a free Cloudflare tunnel (no account needed):

```bash
winget install --id Cloudflare.cloudflared   # once (macOS: brew install cloudflared)
npm run dev                                  # terminal 1
cloudflared tunnel --url http://localhost:5173   # terminal 2: prints https://<random>.trycloudflare.com
```

Open `https://<random>.trycloudflare.com/host` yourself (so the join address on screen is
right) and everyone else opens the same link. Only port 5173 is shared: Vite forwards the
game socket to the server. The link changes each time you restart `cloudflared`.

Other scripts:

```bash
npm run typecheck      # all workspaces
npm run build          # production build of the web app
```

## How it fits together

```
apps/web ── socket.io ──► apps/server
  │  (Vite proxies /socket.io to :3001 in dev)
  │
  ├─ pages/HomePage   join with code + name
  ├─ pages/HostPage   create room, show code, roster, overhead 3D view
  ├─ pages/PlayPage   3D lobby with your player
  └─ game/            scene, avatars, WASD controller, room store

apps/server
  ├─ rooms.ts         in-memory rooms and players (source of truth for live state)
  ├─ handlers.ts      socket events, 15 Hz position broadcast, idle-room cleanup
  ├─ quiz.ts          submission → profile → embedding pipeline (runs in background)
  ├─ sort.ts          the sorting algorithm (pure function; Gemini injected)
  ├─ ai/              Gemini client (limiter, retries, fallback model), profiles, embeddings,
  │                   biome vectors (cached in Postgres), LLM sorting fallback
  ├─ db.ts            write-through persistence to Postgres + pgvector, schema setup
  └─ setup-db.ts      `npm run db:setup`

packages/shared       event contracts, constants, and the fixed questionnaire
```

### The quiz pipeline (phase 2)

1. Host clicks **Start quiz** → room stage becomes `quiz` → every client opens the
   questionnaire (8 multiple choice + 2 optional free-response, in `packages/shared/src/questions.ts`).
2. On submit, the server validates the answers and responds immediately; the rest runs in
   the background while the student walks around again.
3. Gemini writes a 5-sentence profile in a fixed structure and voice (no names, so vectors
   reflect working style only) and rates answer **effort** (`genuine` / `low_effort` / `joke`),
   which phase 3 uses to route students to the LLM fallback.
4. The profile is embedded into a unit-length 768-d **self vector**.
5. Each step updates the player's quiz status (`answering → processing → ready | error`),
   shown live on the host's roster. Everything is written to Postgres.

Gemini calls are capped at 6 in flight (`GEMINI_CONCURRENCY`), retried with backoff, and
fall back to a lighter model on errors like 503 "high demand". A 30-person class is
profiled in roughly 20 seconds.

### Sorting into biomes (phase 3)

Biomes are defined in `packages/shared/src/biomes.ts`. Each has an **ideal-member
profile** written in exactly the same structure and voice as student profiles, embedded
once and cached in the `biomes` table (re-embedded only if the text changes).

When the host clicks **Sort into biomes** (`apps/server/src/sort.ts`):

1. **Vector match.** Cosine similarity between each self vector and each biome vector.
2. **Calibrated within the room.** Each biome's scores are z-scored across the class.
   Raw similarities are bunched (≈0.85–0.97 for everyone) because profiles share a
   template; z-scores make the split relative to *this* room, so even a room full of high
   achievers divides meaningfully. (Rooms under 4 people use raw scores.)
3. **LLM fallback** for close calls (top-two gap < 0.3σ), `low_effort`/`joke` answers, and
   anyone without a vector. Gemini gets the biome profiles plus the student's answers and
   must return exactly one biome id and a one-line reason. Capped at ~25% of the room.
4. **Balancing.** Each biome holds at most `ceil(students / biomes × 1.25)`. Clear-cut
   students are placed first, then LLM-decided, then rules-based, then people who never
   submitted, so borderline students are the ones who move to their next-best biome.
5. **Never hard-fails.** If Gemini is down, students are placed from their
   multiple-choice answers (`rules`); non-submitters fill the smallest group (`filler`).

Every placement records its method and a one-line reason, shown to the student on their
reveal card and to the host (hover a name in the Groups panel).

Players then move into their biome: separate walled areas laid out side by side. Students
only see their own group; the host's camera pulls back to show every biome at once.

- **Live state** (positions, who's connected) lives in server memory. Movement is sent at
  15 Hz, batched per room, and smoothed on clients.
- **Sessions:** joining returns a player token saved in `localStorage`, so refreshing or
  reconnecting puts you back as the same player. Rejoining with the same name while that
  player is offline also reclaims it (new device, cleared storage).
- **Restarting the server ends live rooms.** Their data is already in Postgres, but rooms
  aren't reloaded from it yet.
