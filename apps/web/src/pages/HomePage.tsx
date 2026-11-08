import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH, normalizeRoomCode } from "@unify/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { request } from "@/lib/socket";
import { playerStorage } from "@/lib/storage";

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => normalizeRoomCode(params.get("code") ?? ""));
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    const roomCode = normalizeRoomCode(code);
    setLoading(true);
    try {
      const previous = playerStorage.load(roomCode);
      const result = await request("player:join", {
        code: roomCode,
        name: name.trim(),
        playerToken: previous?.playerToken,
      });
      playerStorage.save(roomCode, { name: name.trim(), playerToken: result.playerToken });
      navigate(`/play/${roomCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,140,255,0.22), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 90%, rgba(56,189,248,0.10), transparent 55%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            U
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Unify</span>
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link to="/host">Host a room</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center px-6 pb-16">
        <h1 className="font-display text-[clamp(2.75rem,10vw,4rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
          Join a room
        </h1>
        <p className="mt-4 text-balance text-muted-foreground">
          Enter the code on your host's screen, answer a short working-style quiz, and get
          sorted into a biome with teammates who work like you.
        </p>

        <form onSubmit={onJoin} className="mt-10 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Room code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              placeholder="ABC123"
              className="h-12 font-mono text-lg tracking-[0.3em] uppercase"
              required
              maxLength={ROOM_CODE_LENGTH}
              autoComplete="off"
              autoFocus={!code}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and last name"
              required
              maxLength={MAX_NAME_LENGTH}
              autoFocus={Boolean(code)}
            />
          </div>
          <Button type="submit" size="lg" disabled={loading} className="h-11 w-full">
            {loading ? "Joining…" : "Join"}
            <ArrowRight />
          </Button>
        </form>
      </main>
    </div>
  );
}
