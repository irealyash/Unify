"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type JoinUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string;
} | null;

type Props = {
  user: JoinUser | undefined;
  code: string;
  officialName: string;
  loading: boolean;
  codeError?: string | null;
  nameError?: string | null;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

function goToGoogleLogin(returnTo: string) {
  window.location.assign(
    `/auth/login?connection=google-oauth2&returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export function JoinSessionCard({
  user,
  code,
  officialName,
  loading,
  codeError,
  nameError,
  onCodeChange,
  onNameChange,
  onSubmit,
}: Props) {
  const authLoading = user === undefined;
  const signedIn = Boolean(user);

  if (authLoading) {
    return (
      <div className="space-y-2.5">
        <div className="h-9 animate-pulse rounded-md bg-muted" />
        <div className="h-9 animate-pulse rounded-md bg-muted" />
        <div className="h-9 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="relative z-20 space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Sign in with Google to join a class pool and save your quiz answers.
        </p>
        <button
          type="button"
          onClick={() => goToGoogleLogin("/")}
          className="relative z-20 flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-foreground text-[13px] font-medium text-background transition-opacity hover:opacity-90"
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => goToGoogleLogin("/create-group")}
          className="relative z-20 inline-flex cursor-pointer text-[12.5px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Create a matching session
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-20 space-y-3">
      <form onSubmit={onSubmit} className="space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor="code" className="text-[12px] font-medium text-muted-foreground">
            Join code
          </Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
            placeholder="CPSC310"
            className={cn(
              "h-9 rounded-md border-border bg-card font-mono text-[13.5px] tracking-[0.12em] shadow-none transition-colors focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground/20",
              codeError && "border-destructive focus-visible:ring-destructive/25",
            )}
            required
            minLength={4}
            maxLength={12}
            autoComplete="off"
            aria-invalid={Boolean(codeError)}
          />
          {codeError ? (
            <p className="text-[11.5px] text-destructive">{codeError}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="name" className="text-[12px] font-medium text-muted-foreground">
            Official name
          </Label>
          <Input
            id="name"
            value={officialName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="As on the class roster"
            className={cn(
              "h-9 rounded-md border-border bg-card text-[13.5px] shadow-none transition-colors focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground/20",
              nameError && "border-destructive focus-visible:ring-destructive/25",
            )}
            required
            minLength={2}
            maxLength={120}
            aria-invalid={Boolean(nameError)}
          />
          {nameError ? (
            <p className="text-[11.5px] text-destructive">{nameError}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-9 w-full rounded-md bg-brand text-[13px] font-medium text-white transition-colors hover:bg-brand-strong"
        >
          {loading ? "Joining…" : "Find my group"}
        </Button>
      </form>

      <Link
        href="/create-group"
        className="inline-flex text-[12.5px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Create a matching session
      </Link>
    </div>
  );
}
