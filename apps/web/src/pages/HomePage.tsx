import { ArrowRight, PencilLine } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  MAX_NAME_LENGTH,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
} from "@unify/shared";
import { PaperNote } from "@/components/PaperNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { request } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { playerStorage } from "@/lib/storage";

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() =>
    normalizeRoomCode(params.get("code") ?? ""),
  );
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"code" | "name" | null>(
    null,
  );

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
      playerStorage.save(roomCode, {
        name: name.trim(),
        playerToken: result.playerToken,
      });
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
            "radial-gradient(ellipse 100% 60% at 50% -15%, rgba(107,140,209,0.12), transparent 70%), radial-gradient(ellipse 50% 40% at 85% 90%, rgba(175,65,65,0.07), transparent 55%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            U
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Unify
          </span>
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link to="/host">Host a room</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center px-6 pb-16">
        <PaperNote className="max-w-sm -rotate-2">
          <h1 className="font-display text-[clamp(2.25rem,9vw,3.25rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
            Unify!
          </h1>
          <p className="mt-3 text-balance text-muted-foreground">
            Your best team starts here
          </p>
        </PaperNote>

        <form onSubmit={onJoin} className="mt-10 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Room code</Label>
            <div className="relative">
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                onFocus={() => setFocusedField("code")}
                onBlur={() => setFocusedField((f) => (f === "code" ? null : f))}
                placeholder="ABC123"
                className="h-12 pr-10 font-mono text-lg tracking-[0.3em] uppercase"
                required
                maxLength={ROOM_CODE_LENGTH}
                autoComplete="off"
                autoFocus={!code}
              />
              <PencilLine
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-primary transition-opacity duration-150",
                  focusedField === "code" ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <div className="relative">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField((f) => (f === "name" ? null : f))}
                placeholder="First and last name"
                className="pr-9"
                required
                maxLength={MAX_NAME_LENGTH}
                autoFocus={Boolean(code)}
              />
              <PencilLine
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary transition-opacity duration-150",
                  focusedField === "name" ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="h-11 w-full"
          >
            {loading ? "Joining…" : "Join"}
            <ArrowRight />
          </Button>
        </form>
      </main>
    </div>
  );
}
