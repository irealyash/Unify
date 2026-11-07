"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  Bell,
  Compass,
  MessageCircle,
  Moon,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import { useUiStore } from "@/stores/ui-store";

const NAV = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { data: notifData } = useNotifications();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const unread = notifData?.unreadCount ?? 0;

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  return (
    <aside className="flex w-[4.5rem] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-5 lg:w-56 lg:items-stretch lg:px-3">
      <Link
        href="/discover"
        className="mb-6 flex items-center justify-center gap-2 px-2 lg:justify-start"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
          M
        </span>
        <span className="hidden font-display text-lg font-semibold tracking-tight lg:inline">
          Mutual
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const showBadge = href === "/notifications" && unread > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:justify-start",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
              {showBadge && (
                <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground lg:static lg:ml-auto">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <Separator className="my-4" />

      <button
        type="button"
        onClick={cycleTheme}
        className="mb-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground lg:justify-start"
        title={`Theme: ${theme}`}
      >
        {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        <span className="hidden capitalize lg:inline">{theme}</span>
      </button>

      <div className="flex items-center justify-center gap-3 px-2 lg:justify-start">
        <UserButton
          appearance={{
            elements: { avatarBox: "h-9 w-9" },
          }}
        />
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-medium">
            {user?.fullName || user?.username || "You"}
          </p>
          <p className="truncate text-xs text-muted-foreground">Account</p>
        </div>
      </div>
    </aside>
  );
}
