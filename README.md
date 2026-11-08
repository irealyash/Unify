# Younify

## Inspiration
One of the most universal pain points for students (and everyone working in group projects) is the difficulty of finding people who work best with your own work habits. Yet, I think we can all agree that working together in a group effectively can be one of life’s most special experiences.
 
## What it does
Younify sorts any group into teams based on how people actually work, and it turns forming groups into a fun, game-like experience.
Hosts create a room and share a code, and participants enter as an avatar in a shared 3D space.
Everyone answers quick questions about their work habits, such as their preferred work schedule, what role they take, and what they expect from teammates. While waiting for everyone to finish responding, participants can stay engaged and have fun by customizing their character appearance!
Younify places each person into an interactive 3d biome that fits them best. For example, Night City is for people who work hard, move fast, and like to stay connected. Highlands is for people who prefer a steady, low-stress pace.
When exploring around their biome, users can see the people who work like them. AI highlights what they have in common, their individual skills, and how they might work together well. Users can choose to connect in person (in physical spaces) or through the links in their profile (ex. in online class settings). 
It’s fun for students and easy for educators to set up!

## How we built it

We started with addressing a real user issue, reading research articles and conducting surveys with other students. To make it a fun and interactive experience, we built the 3D world with React and React Three Fiber, and used a Node server with Socket.IO to keep everyone in the room in sync in real time. Gemini turns each person's quiz answers into a short working-style profile, which we store as a vector in Postgres with pgvector on Tiger Data and match to the closest biome. 

## Challenges we ran into
We had a practical solution (matching people together), but struggled with thinking of how to pair that with a visually appealing UI/UX that felt fun and intuitive to use. After considering multiple scenarios, we decided on focusing on making Younify a way to make a difficult process easier, and making it more fun. Forming groups happens all the time in classes, clubs, workshops and hackathons, and it is usually awkward. We often need to gamble on if we’ll work well together. We decided to build an engaging application and low stake process to find potential teammates, something fun to use and easy for educators to set up.

## Accomplishments that we’re proud of
- Building a web app that’s both practical and visually appealing, fun to use.
- Connecting a 3D multiplayer room, an AI profiling step, vector search, and a sorting algorithm into one smooth flow
- Made it web app playable by everyone at once
- Created ability to customize characters

## What we learned
Research is an important step to figuring out how others would respond to the product. Asking students about their project experience shaped our questionnaire and pushed us from a friend matched to a team-forming tool
We learned to consider how the 3D work changes the user experience

## What’s next for Younify
- Give hosts a final view of every group
- Test Younify with UBC clubs, course teaching teams and hackathons like HackCamp to where there is a larger amount of users
- Adding new biomes for different working styles so larger groups can be sorted with greater diversity (or customization, more biomes for bigger groups)
- Mobile support and optimization

## How sorting works

Gemini turns each person's answers into a short working-style profile, written in a fixed
structure and voice so vectors reflect working style rather than phrasing. That profile is
embedded into a unit-length 768-d vector and stored in Postgres with pgvector. Each biome
has an ideal-member profile embedded the same way.

Placement then runs in three tiers, and never hard-fails:

| Tier | When | Shown as |
|---|---|---|
| Vector match | The normal path — cosine similarity, z-scored across the room so the split is relative to *this* class | `match` |
| Gemini | Close calls, or low-effort/joke answers | `Gemini` |
| Rules | AI unavailable; placed from the multiple-choice answers alone | `rules` |

Groups are then balanced to at most `ceil(students / biomes × 1.25)`, with clear-cut
students placed first so borderline ones are the ones who move (`moved`). People who never
submitted fill the smallest group (`filler`). Every placement records its method and a
one-line reason, shown on the student's reveal card and on the host's roster.

The four biomes (The City, Highlands, The Beach, The Library) are defined in
`packages/shared/src/biomes.ts`.

## Stack

| Part | Tech |
|---|---|
| Web (`apps/web`) | React 19, Vite, react-three-fiber + drei, Tailwind CSS 4, zustand, socket.io-client |
| Server (`apps/server`) | Node + TypeScript (run with `tsx`), Socket.IO, Zod |
| Shared (`packages/shared`) | Socket event contracts, room constants, questionnaire, biomes |
| AI | Gemini for profiles and close-call sorting; `gemini-embedding-001` (768-d) for vectors |
| Database | Postgres + pgvector, via `postgres` (postgres.js) |

## Running it

Requires Node 22+.

```bash
npm install
cp .env.example .env   # fill in GEMINI_API_KEY and DATABASE_URL
npm run db:setup       # enables pgvector and creates tables (safe to re-run)
npm run dev            # server on :3001, web on :5173
```

Open <http://localhost:5173/host> and create a room, then open
<http://localhost:5173> in another browser (or a private window — tabs in the same
browser share a player session) and join with the code.

Both keys are optional for a quick look. Without `DATABASE_URL` nothing is persisted;
without `GEMINI_API_KEY` profiles fall back to a template and every placement comes out as
`rules`.

To fill a room without a crowd, the host can add demo bots that answer the quiz at random.

### Playing together on other machines

Campus Wi-Fi usually blocks laptops from reaching each other, so share the dev server
through a free Cloudflare tunnel (no account needed):

```bash
brew install cloudflared                         # or: winget install --id Cloudflare.cloudflared
npm run dev                                      # terminal 1
cloudflared tunnel --url http://localhost:5173   # terminal 2
```

Open the printed `https://<random>.trycloudflare.com/host` yourself so the join address on
screen is right, and everyone else opens the same link. Only port 5173 is shared — Vite
forwards the game socket to the server. The link changes each restart.

### Other scripts

```bash
npm run typecheck   # all workspaces
npm run build       # production build of the web app
npm run start       # run the server (hosting platforms)
```

## Deploying

The web app is a static Vite build; `vercel.json` builds it and rewrites all routes to
`index.html`. Set `VITE_SERVER_URL` to the server's public URL.

The server needs a **persistent Node process** — it holds live rooms in memory and keeps
WebSockets open, so it can't run on serverless functions. Deploy it anywhere that runs
`npm run start` (Fly, Railway, Render), with `DATABASE_URL`, `GEMINI_API_KEY`, and
`WEB_ORIGIN` set to the web app's origin for CORS.

## Layout

```
apps/web
  ├─ pages/HomePage   join with code + name
  ├─ pages/HostPage   create room, show code, roster, overhead 3D view
  ├─ pages/PlayPage   3D lobby with your player
  └─ game/            scenes, avatars, character customiser, WASD controller, room store

apps/server
  ├─ rooms.ts         in-memory rooms and players (source of truth for live state)
  ├─ handlers.ts      socket events, 15 Hz position broadcast, idle-room cleanup
  ├─ quiz.ts          submission → profile → embedding pipeline (runs in background)
  ├─ sort.ts          the sorting algorithm (pure function; Gemini injected)
  ├─ bots.ts          demo bots
  ├─ ai/              Gemini client (limiter, retries, fallback model), profiles,
  │                   embeddings, biome vectors cached in Postgres
  └─ db.ts            write-through persistence to Postgres + pgvector

packages/shared       event contracts, constants, questionnaire, biome definitions
```

Notes on live state:

- Positions and connection status live in server memory, sent at 15 Hz, batched per room
  and smoothed on clients.
- Joining returns a player token saved in `localStorage`, so refreshing or reconnecting
  puts you back as the same player. Rejoining with the same name while that player is
  offline also reclaims it.
- Restarting the server ends live rooms. Their data is already in Postgres, but rooms
  aren't reloaded from it.
