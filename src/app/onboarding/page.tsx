"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clientApi } from "@/lib/client-api";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selfText, setSelfText] = useState("");
  const [seekingText, setSeekingText] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (username.length < 3) return;

    const t = setTimeout(() => {
      setChecking(true);
      void clientApi<{ available: boolean; reason?: string }>(
        `/api/profile/username-availability?username=${encodeURIComponent(username)}`,
      )
        .then((res) => {
          setAvailable(res.available);
          setReason(res.reason ?? null);
        })
        .catch(() => {
          setAvailable(null);
          setReason(null);
        })
        .finally(() => setChecking(false));
    }, 400);

    return () => clearTimeout(t);
  }, [username]);

  const availability = username.length < 3 ? null : available;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!availability) {
      toast.error(reason || "Choose an available username");
      return;
    }
    setSubmitting(true);
    try {
      const result = await clientApi<{
        username: string;
        hasSelfEmbedding: boolean;
        hasSeekingEmbedding: boolean;
      }>("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          username,
          displayName: displayName || undefined,
          selfText,
          seekingText,
        }),
      });

      if (!result.hasSelfEmbedding || !result.hasSeekingEmbedding) {
        toast.error("Profile saved, but embeddings failed. Try again.");
        return;
      }

      toast.success("Welcome to Mutual");
      router.push("/discover");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
        <div className="mb-10 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground font-display text-sm font-bold text-background">
            M
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Set up your profile
          </h1>
          <p className="text-muted-foreground">
            Two questions power every match: who you are, and who you&apos;re looking for.
          </p>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
                }
                placeholder="yash"
                autoComplete="username"
                required
                minLength={3}
              />
              {checking && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {availability === true && (
              <p className="text-xs text-foreground/70">Username is available</p>
            )}
            {availability === false && (
              <p className="text-xs text-destructive">{reason || "Username unavailable"}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display name (optional)</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How friends know you"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="selfText">Who are you?</Label>
            <p className="text-xs text-muted-foreground">
              Personality, interests, background, skills, ambitions, values, lifestyle.
            </p>
            <Textarea
              id="selfText"
              value={selfText}
              onChange={(e) => setSelfText(e.target.value)}
              placeholder="What you're like, what you're building, what you care about…"
              required
              minLength={40}
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seekingText">Who are you looking for?</Label>
            <p className="text-xs text-muted-foreground">
              The people you want to meet, their qualities, and the dynamic you hope for.
            </p>
            <Textarea
              id="seekingText"
              value={seekingText}
              onChange={(e) => setSeekingText(e.target.value)}
              placeholder="Friends, collaborators, thoughtful conversations…"
              required
              minLength={40}
              className="min-h-[120px]"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className={cn("w-full")}
            disabled={submitting || !availability}
          >
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? "Saving profile & embeddings…" : "Enter Mutual"}
          </Button>
        </form>
      </div>
    </div>
  );
}
