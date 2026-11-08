"use client";

import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type NavUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string;
} | null;

export function Navbar({
  user,
  loading,
  className,
}: {
  user: NavUser | undefined;
  loading?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md", className)}>
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between px-5 md:px-6">
        <BrandLogo />

        <div className="flex items-center gap-1.5">
          <ThemeToggle />

          {loading || user === undefined ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={user.pictureUrl || undefined} alt="" />
                    <AvatarFallback className="text-[9px]">
                      {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[110px] truncate sm:inline">
                    {user.name || user.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-md">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-[13px] font-medium text-foreground">
                    {user.name || "Account"}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/auth/logout" className="cursor-pointer text-[13px]">
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Log out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.location.assign(
                  `/auth/login?connection=google-oauth2&returnTo=${encodeURIComponent("/")}`,
                );
              }}
              className="inline-flex h-8 cursor-pointer items-center rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
