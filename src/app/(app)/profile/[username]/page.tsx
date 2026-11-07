"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UbcBadge } from "@/components/ubc/ubc-badge";
import { PersonCard } from "@/components/discovery/person-card";
import { clientApi } from "@/lib/client-api";
import type { DiscoveryPerson } from "@/types/api";

type PublicProfile = {
  person: DiscoveryPerson;
};

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => clientApi<PublicProfile>(`/api/users/${encodeURIComponent(username)}`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12 space-y-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !data?.person) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-muted-foreground">Profile not found.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/discover">Back to Discover</Link>
        </Button>
      </div>
    );
  }

  const p = data.person;
  const tags = [...(p.interests ?? []), ...(p.skills ?? [])];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20">
          <AvatarImage src={p.avatarUrl ?? undefined} />
          <AvatarFallback>{(p.displayName || p.username).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">
              {p.displayName || p.username}
            </h1>
            <UbcBadge claim={p.isUbcStudentClaim} verified={p.isUbcVerified} />
          </div>
          <p className="text-muted-foreground">@{p.username}</p>
        </div>
      </div>

      <section className="mb-10 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">About</h2>
        <p className="text-lg leading-relaxed">{p.publicSummary || "No summary yet."}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Connect
        </h2>
        <PersonCard person={p} className="max-w-md" />
      </section>
    </div>
  );
}
