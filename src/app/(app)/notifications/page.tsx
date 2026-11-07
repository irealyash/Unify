"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/use-notifications";

export default function NotificationsPage() {
  const { data, isLoading, markRead } = useNotifications();
  const notifications = data?.notifications ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-2 text-muted-foreground">
            {data?.unreadCount ? `${data.unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {(data?.unreadCount ?? 0) > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void markRead.mutateAsync(undefined)}
          >
            Mark all read
          </Button>
        )}
      </header>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Bell className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-2">
        {notifications.map((n) => (
          <li key={n.id}>
            <Link
              href={n.href || "#"}
              onClick={() => {
                if (!n.readAt) void markRead.mutateAsync([n.id]);
              }}
              className={cnNotification(n.readAt)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cnNotification(readAt: string | null) {
  const base =
    "block rounded-xl border border-border p-4 transition-colors hover:bg-muted/40";
  return readAt ? `${base} bg-card` : `${base} bg-accent/5 border-accent/20`;
}
