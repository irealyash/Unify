"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MeUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string;
};

export function SiteHeader({ className }: { className?: string }) {
  const [user, setUser] = useState<MeUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();
        if (!cancelled) setUser(data.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-[#e8eaed] bg-[#f7f8fa]/85 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111] text-[11px] font-bold text-white">
              M
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-[#111]">
              Mutual
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-[#5f6368] md:flex">
            <Link href="/" className="transition hover:text-[#111]">
              Join
            </Link>
            <Link href="/create-group" className="transition hover:text-[#111]">
              Create
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user === undefined ? (
            <div className="h-8 w-24 animate-pulse rounded-full bg-[#eceff3]" />
          ) : user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                {user.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.pictureUrl}
                    alt=""
                    className="h-7 w-7 rounded-full border border-[#e8eaed] object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eceff3] text-xs font-medium text-[#5f6368]">
                    {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="max-w-[140px] truncate text-sm text-[#5f6368]">
                  {user.name || user.email}
                </span>
              </div>
              <a
                href="/auth/logout"
                className="text-sm text-[#5f6368] transition hover:text-[#111]"
              >
                Log out
              </a>
              <Button
                asChild
                className="h-9 rounded-full bg-[#111] px-4 text-sm text-white hover:bg-[#222]"
              >
                <Link href="/create-group">
                  Create group
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <a
                href="/auth/login?connection=google-oauth2&returnTo=/"
                className="text-sm font-medium text-[#5f6368] transition hover:text-[#111]"
              >
                Sign in with Google
              </a>
              <Button
                asChild
                className="h-9 rounded-full bg-[#111] px-4 text-sm text-white hover:bg-[#222]"
              >
                <a href="/auth/login?connection=google-oauth2&returnTo=/create-group">
                  Create group
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
