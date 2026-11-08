"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, ready } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {!ready ? (
        <span className="h-3.5 w-3.5 rounded-sm bg-muted-foreground/25" />
      ) : theme === "dark" ? (
        <Sun className="h-3.5 w-3.5" strokeWidth={1.75} />
      ) : (
        <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
    </button>
  );
}
