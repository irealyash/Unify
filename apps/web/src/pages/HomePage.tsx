import { ArrowRight, PencilLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  MAX_NAME_LENGTH,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
} from "@unify/shared";
import { BookmarkTag } from "@/components/BookmarkTag";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { PaperNote } from "@/components/PaperNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGoogleAuth } from "@/lib/auth";
import { request } from "@/lib/socket";
import { playerStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Join links use `?code=ABC123`. Auth0 redirects with a long OAuth `code` — ignore those. */
function roomCodeFromSearch(params: URLSearchParams) {
  if (params.has("state")) return ""; // Auth0 callback always includes state
  const raw = params.get("code");
  if (!raw) return "";
  const normalized = normalizeRoomCode(raw);
  if (normalized.length !== ROOM_CODE_LENGTH) return "";
  return normalized;
}

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated, user, ready, ensureSocketAuth } = useGoogleAuth();
  const [code, setCode] = useState(() => roomCodeFromSearch(params));
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"code" | "name" | null>(
    null,
  );

  useEffect(() => {
    if (user?.name && !name) setName(user.name);
  }, [user, name]);

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Sign in with Google to join a room");
      return;
    }
    const roomCode = normalizeRoomCode(code);
    setLoading(true);
    try {
      await ensureSocketAuth();
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

  const canJoin = isAuthenticated && ready;

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
        <div className="group relative">
          <BookmarkTag className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[125px] w-[166px] origin-top -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 ease-in group-hover:scale-y-125" />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xl hover:bg-transparent"
          >
            <Link to="/host">Host Room</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center px-6 pb-16">
        <PaperNote className="max-w-sm -rotate-2">
          <h1 className="font-display text-[clamp(2.25rem,9vw,3.25rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
            unify
          </h1>
          <p className="mt-3 text-balance text-muted-foreground">
            Your best team starts here
          </p>
        </PaperNote>

        <form onSubmit={onJoin} className="mt-10 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Room code:</Label>
            <div className="relative">
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                onFocus={() => setFocusedField("code")}
                onBlur={() => setFocusedField((f) => (f === "code" ? null : f))}
                placeholder="ABC123"
                className="h-12 pr-10 text-lg tracking-[0.3em]"
                required
                maxLength={ROOM_CODE_LENGTH}
                autoComplete="off"
                autoFocus={!code}
                disabled={!canJoin}
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
            <Label htmlFor="name">Your name:</Label>
            <div className="relative">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField((f) => (f === "name" ? null : f))}
                placeholder="Name"
                className="h-12 pr-9"
                required
                maxLength={MAX_NAME_LENGTH}
                autoFocus={Boolean(code)}
                disabled={!canJoin}
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
          <div className="group relative">
            <BookmarkTag className="pointer-events-none absolute -top-1 right-6 z-20 h-9 w-7 origin-top transition-transform duration-300 ease-in group-hover:scale-y-125" />
            <Button
              type="submit"
              size="lg"
              disabled={loading || !canJoin}
              className="h-11 w-full"
            >
              {loading ? "Joining…" : "Join"}
              <ArrowRight />
            </Button>
          </div>
        </form>

        <div className="mt-4 space-y-3">
          <GoogleAuthButton />
          {!isAuthenticated && ready ? (
            <p className="text-center text-xs text-muted-foreground">
              Sign in with Google to join or host a room.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
