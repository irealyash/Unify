"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UbcBadge } from "@/components/ubc/ubc-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFriendships } from "@/hooks/use-friendships";
import { cn } from "@/lib/utils";
import type { DiscoveryPerson } from "@/types/api";

type PersonCardProps = {
  person: DiscoveryPerson;
  showMutualBreakdown?: boolean;
  className?: string;
};

function initials(name: string | null | undefined, username: string) {
  const base = name?.trim() || username;
  return base
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PersonCard({ person, showMutualBreakdown, className }: PersonCardProps) {
  const { sendRequest, accept, decline } = useFriendships();
  const pending =
    sendRequest.isPending || accept.isPending || decline.isPending;

  const interests = [...(person.interests ?? []), ...(person.skills ?? [])].slice(0, 5);

  const onFriendAction = async () => {
    try {
      if (person.friendshipStatus === "NONE" || person.friendshipStatus === "DECLINED") {
        await sendRequest.mutateAsync(person.id);
        toast.success("Friend request sent");
        return;
      }
      if (person.friendshipStatus === "PENDING_INCOMING" && person.friendshipId) {
        await accept.mutateAsync(person.friendshipId);
        toast.success("You are now friends");
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  let actionLabel = "Connect";
  let actionVariant: "accent" | "secondary" | "outline" = "accent";
  let actionDisabled = pending;

  switch (person.friendshipStatus) {
    case "FRIENDS":
      actionLabel = "Friends";
      actionVariant = "secondary";
      actionDisabled = true;
      break;
    case "PENDING_OUTGOING":
      actionLabel = "Pending";
      actionVariant = "outline";
      actionDisabled = true;
      break;
    case "PENDING_INCOMING":
      actionLabel = "Accept";
      actionVariant = "accent";
      break;
    case "BLOCKED":
      actionLabel = "Unavailable";
      actionVariant = "outline";
      actionDisabled = true;
      break;
    default:
      break;
  }

  return (
    <Card className={cn("flex flex-col transition-shadow hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
        <Link href={`/profile/${person.username}`} className="shrink-0">
          <Avatar className="h-12 w-12">
            <AvatarImage src={person.avatarUrl ?? undefined} alt={person.username} />
            <AvatarFallback>{initials(person.displayName, person.username)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/profile/${person.username}`}
              className="font-display text-base font-semibold hover:opacity-70"
            >
              {person.displayName || person.username}
            </Link>
            <UbcBadge claim={person.isUbcStudentClaim} verified={person.isUbcVerified} />
          </div>
          <p className="text-sm text-muted-foreground">@{person.username}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold tabular-nums">{person.score}%</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">match</p>
          {showMutualBreakdown && person.scoreAB != null && person.scoreBA != null && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {person.scoreAB}% · {person.scoreBA}%
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90">
          {person.publicSummary || "No public summary yet."}
        </p>
        {interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {interests.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[11px] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-auto flex gap-2 pt-1">
          <Button
            variant={actionVariant}
            className="flex-1"
            disabled={actionDisabled}
            onClick={() => void onFriendAction()}
          >
            {pending && <Loader2 className="animate-spin" />}
            {actionLabel}
          </Button>
          {person.friendshipStatus === "PENDING_INCOMING" && person.friendshipId && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                void decline.mutateAsync(person.friendshipId!).then(() => toast.message("Declined"))
              }
            >
              Decline
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
