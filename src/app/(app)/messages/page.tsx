"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations } from "@/hooks/use-conversations";

export default function MessagesPage() {
  const { data, isLoading } = useConversations();
  const conversations = data?.conversations ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-2 text-muted-foreground">Chats with accepted friends.</p>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && conversations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Accept a friend request to start messaging.
            </p>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-2">
        {conversations.map((c) => {
          const u = c.otherUser;
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <Avatar>
                  <AvatarImage src={u.avatarUrl ?? undefined} />
                  <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{u.displayName || u.username}</p>
                    {c.lastMessage && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.lastMessage.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.lastMessage?.content ?? "No messages yet"}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
