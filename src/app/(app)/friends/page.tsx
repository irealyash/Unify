"use client";

import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFriendships } from "@/hooks/use-friendships";

export default function FriendsPage() {
  const { data, isLoading, accept, decline } = useFriendships();
  const friendships = data?.friendships ?? [];

  const incoming = friendships.filter((f) => f.uiStatus === "PENDING_INCOMING");
  const friends = friendships.filter((f) => f.uiStatus === "FRIENDS");
  const outgoing = friendships.filter((f) => f.uiStatus === "PENDING_OUTGOING");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Friends</h1>
        <p className="mt-2 text-muted-foreground">Requests and connections in one place.</p>
      </header>

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && incoming.length > 0 && (
        <section className="mb-10 space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Incoming requests
          </h2>
          {incoming.map((f) => {
            const u = f.otherUser;
            return (
              <Card key={f.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar>
                    <AvatarImage src={u?.avatarUrl ?? undefined} />
                    <AvatarFallback>{u?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={u?.username ? `/profile/${u.username}` : "#"}
                      className="font-medium hover:text-accent"
                    >
                      {u?.displayName || u?.username}
                    </Link>
                    <p className="text-sm text-muted-foreground">@{u?.username}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="accent"
                    disabled={accept.isPending}
                    onClick={() =>
                      void accept.mutateAsync(f.id).then(() => toast.success("Accepted"))
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decline.isPending}
                    onClick={() => void decline.mutateAsync(f.id)}
                  >
                    Decline
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your friends
        </h2>
        {friends.length === 0 && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <UserPlus className="h-4 w-4 text-accent" />
                No friends yet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Discover people on{" "}
                <Link href="/discover" className="text-accent hover:underline">
                  Discover
                </Link>{" "}
                and send a request.
              </p>
            </CardContent>
          </Card>
        )}
        {friends.map((f) => {
          const u = f.otherUser;
          return (
            <Card key={f.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar>
                  <AvatarImage src={u?.avatarUrl ?? undefined} />
                  <AvatarFallback>{u?.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{u?.displayName || u?.username}</p>
                  <p className="text-sm text-muted-foreground">@{u?.username}</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/profile/${u?.username}`}>View</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {outgoing.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Sent requests
          </h2>
          {outgoing.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex items-center gap-4 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4" />
                Pending — {f.otherUser?.displayName || f.otherUser?.username}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
