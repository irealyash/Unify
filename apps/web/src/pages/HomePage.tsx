import { ArrowRight, PencilLine } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  MAX_NAME_LENGTH,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
} from "@unify/shared";
import { BookmarkTag } from "@/components/BookmarkTag";
import { ModelCredits } from "@/components/PageExtras";
import { PaperNote } from "@/components/PaperNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HomeBackdrop } from "@/game/HomeBackdrop";
import { request } from "@/lib/socket";
import { playerStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Join links use `?code=ABC123`. */
function roomCodeFromSearch(params: URLSearchParams) {
  const raw = params.get("code");
  if (!raw) return "";
  const normalized = normalizeRoomCode(raw);
  if (normalized.length !== ROOM_CODE_LENGTH) return "";
  return normalized;
}

const FIELD_LABEL = "mb-1.5 block h-6 text-xl leading-6 text-white";
const FIELD_BOX = "h-11 pr-10 text-base";
const FIELD_ICON =
  "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary transition-opacity duration-150";

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => roomCodeFromSearch(params));
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
      <HomeBackdrop />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 60% at 50% -15%, rgba(107,140,209,0.12), transparent 70%), radial-gradient(ellipse 50% 40% at 85% 90%, rgba(175,65,65,0.07), transparent 55%)",
        }}
      />

      <header className="[text-shadow:0_1px_3px_rgba(0,0,0,0.85)] relative z-10 flex w-full items-center justify-between px-6 py-5 md:absolute md:inset-x-0 md:top-0">
        <Link to="/" className="font-display text-4xl font-semibold leading-none tracking-tight">
          younify
        </Link>
        <div className="flex items-center gap-3">
          {/* TEMP (testing): jump straight into The City scene. Dev builds only. */}
          {import.meta.env.DEV ? (
            <Button asChild variant="ghost" size="sm" className="text-xl">
              <Link to="/preview/night_city">Go to The City</Link>
            </Button>
          ) : null}
          <div className="group relative">
            <BookmarkTag className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[132px] w-[176px] origin-top -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 ease-in group-hover:scale-y-125" />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xl hover:bg-transparent"
            >
              <Link to="/host">Host Room</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center px-6 pb-6 md:min-h-screen md:py-2">
        <PaperNote className="max-w-sm -rotate-2">
          <div className="-translate-y-5">
            <h1 className="font-display text-[clamp(2.25rem,9vw,3.25rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
              younify
            </h1>
            <p className="mt-3 text-balance text-muted-foreground">
              Your best team starts here!
            </p>
          </div>
        </PaperNote>

        <form onSubmit={onJoin} className="[text-shadow:0_1px_3px_rgba(0,0,0,0.85)] mx-auto mt-8 w-full max-w-[21rem] space-y-3">
          <div>
            <Label htmlFor="code" className={FIELD_LABEL}>
              Room code:
            </Label>
            <div className="relative">
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                onFocus={() => setFocusedField("code")}
                onBlur={() => setFocusedField((f) => (f === "code" ? null : f))}
                placeholder="ABC123"
                className={cn(FIELD_BOX, "tracking-[0.3em]")}
                required
                maxLength={ROOM_CODE_LENGTH}
                autoComplete="off"
                autoFocus={!code}
              />
              <PencilLine
                aria-hidden="true"
                className={cn(
                  FIELD_ICON,
                  focusedField === "code" ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="name" className={FIELD_LABEL}>
              Your name:
            </Label>
            <div className="relative">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField((f) => (f === "name" ? null : f))}
                placeholder="Name"
                className={FIELD_BOX}
                required
                maxLength={MAX_NAME_LENGTH}
                autoFocus={Boolean(code)}
              />
              <PencilLine
                aria-hidden="true"
                className={cn(
                  FIELD_ICON,
                  focusedField === "name" ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          </div>
          <div className="group relative !mt-5">
            <BookmarkTag className="pointer-events-none absolute -top-1 right-5 z-20 h-8 w-6 origin-top transition-transform duration-300 ease-in group-hover:scale-y-125" />
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="h-11 w-full text-xl [&_svg]:size-5"
            >
              {loading ? "Joining…" : "Join"}
              <ArrowRight />
            </Button>
          </div>
        </form>
      </main>

      <ModelCredits />
    </div>
  );
}
