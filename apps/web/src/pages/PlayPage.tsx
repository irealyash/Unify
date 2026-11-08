import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { BIOME_BY_ID, normalizeRoomCode, type PlayerState, type Stage } from "@unify/shared";
import { Button } from "@/components/ui/button";
import { BiomeReveal } from "@/game/BiomeReveal";
import { QuizPanel } from "@/game/QuizPanel";
import { SortingOverlay } from "@/game/SortingOverlay";
import { useRoom, useRoomEvents } from "@/game/store";
import { WorldScene } from "@/game/WorldScene";
import { onEveryConnect, request, socket } from "@/lib/socket";
import { playerStorage } from "@/lib/storage";

const revealKey = (code: string) => `unify:revealed:${code}`;

function readRevealed(code: string) {
  try {
    return sessionStorage.getItem(revealKey(code)) === "1";
  } catch {
    return false;
  }
}

export function PlayPage() {
  const code = normalizeRoomCode(useParams().code ?? "");
  const navigate = useNavigate();
  const selfId = useRoom((s) => s.selfId);
  const players = useRoom((s) => s.players);
  const stage = useRoom((s) => s.stage);
  const [replaced, setReplaced] = useState(false);
  const [revealed, setRevealed] = useState(() => readRevealed(code));

  useRoomEvents();

  useEffect(() => {
    const saved = playerStorage.load(code);
    if (!saved) {
      navigate(`/?code=${code}`, { replace: true });
      return;
    }

    let active = true;
    const join = async () => {
      try {
        const result = await request("player:join", {
          code,
          name: saved.name,
          playerToken: saved.playerToken,
        });
        if (!active) return;
        playerStorage.save(code, { name: saved.name, playerToken: result.playerToken });
        useRoom.getState().applySnapshot(result.room, result.playerId);
      } catch (err) {
        if (!active) return;
        toast.error(err instanceof Error ? err.message : "Could not join the room");
        playerStorage.clear(code);
        navigate(`/?code=${code}`, { replace: true });
      }
    };

    const onReplaced = () => setReplaced(true);
    socket.on("session:replaced", onReplaced);
    const stopConnect = onEveryConnect(join);
    return () => {
      active = false;
      stopConnect();
      socket.off("session:replaced", onReplaced);
    };
  }, [code, navigate]);

  const everyone = Object.values(players);
  const self = selfId ? players[selfId] : undefined;
  const teammates = everyone.filter(
    (p) => p.id !== selfId && p.placement && p.placement.biome === self?.placement?.biome,
  );
  const quizOpen = stage === "quiz" && (self?.quiz === "answering" || self?.quiz === "error");
  const showReveal = stage === "biomes" && Boolean(self?.placement) && !revealed;
  const status = statusLine(stage, self, everyone, teammates);
  const joinUrl = `${window.location.origin}/?code=${code}`;

  function closeReveal() {
    setRevealed(true);
    try {
      sessionStorage.setItem(revealKey(code), "1");
    } catch {
      // Not critical: the card would just show again after a refresh.
    }
  }

  async function leave() {
    try {
      await request("player:leave");
    } catch {
      // Even if the server is unreachable, forget the session locally.
    }
    playerStorage.clear(code);
    navigate(`/?code=${code}`);
  }

  if (replaced) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Opened in another tab</h1>
        <p className="text-muted-foreground">You can only be in the room from one tab at a time.</p>
        <Button onClick={() => window.location.reload()}>Use this tab instead</Button>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-[#f3f4f7]">
      {selfId ? (
        <WorldScene selfId={selfId} frozen={quizOpen || showReveal} />
      ) : (
        <div className="hud-muted flex h-full items-center justify-center">Joining room…</div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="hud rounded-md px-4 py-3">
          <h3 className="hud-muted font-handwritten text-sm tracking-wider">Room</h3>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(joinUrl);
              toast.success("Join link copied");
            }}
            aria-label="Copy join link"
            className="pointer-events-auto font-handwritten text-2xl font-semibold tracking-[0.2em] transition hover:opacity-80"
          >
            {code}
          </button>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="hud rounded-md px-4 py-3 text-right">
            <h3 className="hud-muted font-handwritten text-sm tracking-wider">{status.title}</h3>
            <div className="text-base">{status.detail}</div>
          </div>
          <button
            type="button"
            onClick={leave}
            className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-base text-destructive-foreground shadow-[0_6px_20px_-10px_rgb(15_18_34_/_0.25)] backdrop-blur-[8px] transition hover:opacity-90"
          >
            <LogOut className="h-5 w-5" />
            Leave
          </button>
        </div>
      </div>

      {quizOpen ? <QuizPanel code={code} retry={self?.quiz === "error"} /> : null}
      {stage === "sorting" ? <SortingOverlay players={everyone} /> : null}
      {showReveal && self ? (
        <BiomeReveal self={self} teammates={teammates} onClose={closeReveal} />
      ) : null}

      {!quizOpen && stage !== "sorting" && !showReveal ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-5">
          <div className="hud hud-muted rounded-full px-4 py-2 text-base">
            <kbd className="font-handwritten text-[#f5f1ed]">WASD</kbd> or arrow keys to move
          </div>
        </div>
      ) : null}
    </div>
  );
}

function statusLine(
  stage: Stage,
  self: PlayerState | undefined,
  everyone: PlayerState[],
  teammates: PlayerState[],
) {
  const online = everyone.filter((p) => p.connected).length;
  if (stage === "lobby") return { title: "Lobby", detail: `${online} here, waiting for host` };
  if (stage === "quiz") {
    if (self?.quiz === "processing") return { title: "Quiz", detail: "Reading your answers…" };
    if (self?.quiz === "ready") {
      const done = everyone.filter((p) => p.quiz === "ready").length;
      return { title: "Quiz", detail: `${done}/${everyone.length} done, waiting for the sort` };
    }
    return { title: "Quiz", detail: "Answer the questions" };
  }
  if (stage === "sorting") return { title: "Sorting", detail: "Finding your biome…" };
  const biome = self?.placement ? BIOME_BY_ID.get(self.placement.biome) : undefined;
  return {
    title: biome?.name ?? "Biomes",
    detail: `${teammates.length + 1} in your group`,
  };
}
