import { Copy, Play, Plus, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { BIOMES, type HostSession, type PlayerState, type SortMethod } from "@unify/shared";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SortingOverlay } from "@/game/SortingOverlay";
import { useRoom, useRoomEvents } from "@/game/store";
import { WorldScene } from "@/game/WorldScene";
import { useGoogleAuth } from "@/lib/auth";
import { onEveryConnect, request } from "@/lib/socket";
import { hostStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function HostPage() {
  const { isAuthenticated, ready: authReady, ensureSocketAuth } = useGoogleAuth();
  const [session, setSession] = useState<HostSession | null>(() => hostStorage.load());
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const code = useRoom((s) => s.code);
  const stage = useRoom((s) => s.stage);
  const players = useRoom((s) => s.players);

  useRoomEvents();

  useEffect(() => {
    if (!session) return;
    let active = true;
    const attach = async () => {
      try {
        const snapshot = await request("host:attach", session);
        if (active) useRoom.getState().applySnapshot(snapshot);
      } catch (err) {
        if (!active) return;
        toast.error(err instanceof Error ? err.message : "Could not reopen the room");
        hostStorage.clear();
        setSession(null);
      }
    };
    const stop = onEveryConnect(attach);
    return () => {
      active = false;
      stop();
    };
  }, [session]);

  async function createRoom() {
    if (!isAuthenticated) {
      toast.error("Sign in with Google to host a room");
      return;
    }
    setCreating(true);
    try {
      await ensureSocketAuth();
      const created = await request("host:create");
      hostStorage.save(created);
      setSession(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create a room");
    } finally {
      setCreating(false);
    }
  }

  async function run(event: "host:startQuiz" | "host:sort", failure: string) {
    setBusy(true);
    try {
      await request(event);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    const canHost = isAuthenticated && authReady;
    return (
      <div className="flex min-h-full items-center justify-center px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Host a room</CardTitle>
            <CardDescription>
              Create a room, put the code on the projector, and your class joins from their
              laptops.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={createRoom}
              disabled={creating || !canHost}
            >
              <Plus />
              {creating ? "Creating…" : "Create room"}
            </Button>
            <GoogleAuthButton />
            {!isAuthenticated && authReady ? (
              <p className="text-center text-xs text-muted-foreground">
                Sign in with Google to host a room.
              </p>
            ) : null}
            <Button asChild variant="ghost" className="w-full">
              <Link to="/">Join a room instead</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roster = Object.values(players).sort((a, b) => a.name.localeCompare(b.name));
  const online = roster.filter((p) => p.connected).length;
  const ready = roster.filter((p) => p.quiz === "ready").length;
  const submitted = roster.filter((p) => p.quiz !== "answering").length;
  const stillAnswering = roster.length - submitted;
  const joinUrl = `${window.location.origin}/?code=${session.code}`;

  const heading =
    stage === "lobby" ? "Lobby" : stage === "quiz" ? "Quiz" : stage === "sorting" ? "Sorting" : "Groups";
  const counter =
    stage === "lobby"
      ? `${online} joined`
      : stage === "quiz"
        ? `${ready}/${roster.length} ready`
        : `${roster.length} people`;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="relative min-h-[50vh] flex-1 bg-[#f3f4f7]">
        {code ? <WorldScene spectator /> : null}
        {stage === "lobby" || stage === "quiz" ? (
          <div className="hud pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-2xl px-8 py-4 text-center">
            <div className="hud-muted text-sm">
              Join at <span className="font-medium text-[#0f1222]">{window.location.host}</span>{" "}
              with code
            </div>
            <div className="font-mono text-5xl font-semibold tracking-[0.25em]">{session.code}</div>
          </div>
        ) : null}
        {stage === "sorting" ? <SortingOverlay players={roster} /> : null}
      </div>

      <aside className="flex w-full flex-col gap-4 border-t border-border bg-card p-5 lg:w-80 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{heading}</h2>
          <span className="text-sm text-muted-foreground">{counter}</span>
        </div>

        {stage === "quiz" ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${roster.length ? (ready / roster.length) * 100 : 0}%` }}
            />
          </div>
        ) : null}

        {stage === "lobby" || stage === "quiz" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(joinUrl);
              toast.success("Join link copied");
            }}
          >
            <Copy />
            Copy join link
          </Button>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {stage === "biomes" ? <Groups roster={roster} /> : <Roster roster={roster} stage={stage} />}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          {stage === "lobby" ? (
            <Button
              className="w-full"
              onClick={() => run("host:startQuiz", "Could not start the quiz")}
              disabled={busy || online === 0}
            >
              <Play />
              Start quiz
            </Button>
          ) : null}
          {stage === "quiz" ? (
            <>
              {stillAnswering > 0 && submitted > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {stillAnswering} still answering. If you sort now they'll be placed to balance
                  the groups.
                </p>
              ) : null}
              <Button
                className="w-full"
                onClick={() => run("host:sort", "Could not sort the room")}
                disabled={busy || submitted === 0}
              >
                <Shuffle />
                Sort into biomes
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              hostStorage.clear();
              setSession(null);
            }}
          >
            New room
          </Button>
        </div>
      </aside>
    </div>
  );
}

function Roster({ roster, stage }: { roster: PlayerState[]; stage: string }) {
  if (roster.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">Waiting for people to join…</p>
    );
  }
  return (
    <ul className="space-y-1">
      {roster.map((p) => (
        <li
          key={p.id}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm",
            !p.connected && "opacity-45",
          )}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span className="truncate">{p.name}</span>
          <span className="ml-auto flex items-center gap-2">
            {!p.connected ? <span className="text-xs text-muted-foreground">away</span> : null}
            {stage !== "lobby" ? <QuizBadge status={p.quiz} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

const METHOD_LABELS: Record<SortMethod, { label: string; hint: string }> = {
  vector: { label: "match", hint: "Closest biome by vector similarity" },
  llm: { label: "Gemini", hint: "Close call or low-signal answers, decided by Gemini" },
  rebalanced: { label: "moved", hint: "First choice was full; placed in next-best biome" },
  rules: { label: "rules", hint: "AI unavailable; placed from answers" },
  filler: { label: "no quiz", hint: "Didn't submit; placed to balance groups" },
};

/** Final groups, one section per biome, with how each person was placed. */
function Groups({ roster }: { roster: PlayerState[] }) {
  return (
    <div className="space-y-5">
      {BIOMES.map((biome) => {
        const members = roster.filter((p) => p.placement?.biome === biome.id);
        return (
          <section key={biome.id}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: biome.colors.accent }} />
              <h3 className="text-sm font-semibold">{biome.name}</h3>
              <span className="ml-auto text-xs text-muted-foreground">{members.length}</span>
            </div>
            {members.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">Nobody here</p>
            ) : (
              <ul className="space-y-0.5">
                {members.map((p) => {
                  const method = p.placement ? METHOD_LABELS[p.placement.method] : null;
                  return (
                    <li
                      key={p.id}
                      title={p.placement?.reason}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm",
                        !p.connected && "opacity-45",
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="truncate">{p.name}</span>
                      {method ? (
                        <span
                          title={method.hint}
                          className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {method.label}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

const BADGES: Record<PlayerState["quiz"], { label: string; className: string }> = {
  answering: { label: "answering", className: "text-muted-foreground" },
  processing: { label: "thinking…", className: "animate-pulse text-primary" },
  ready: { label: "ready", className: "text-emerald-400" },
  error: { label: "error", className: "text-destructive" },
};

function QuizBadge({ status }: { status: PlayerState["quiz"] }) {
  const badge = BADGES[status];
  return <span className={cn("text-xs font-medium", badge.className)}>{badge.label}</span>;
}
