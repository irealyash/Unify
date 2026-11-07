"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Users } from "lucide-react";
import { DiscoveryTabs } from "@/components/discovery/discovery-tabs";
import { PersonCard } from "@/components/discovery/person-card";
import { UbcFilterSelect } from "@/components/discovery/ubc-filter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDiscovery } from "@/hooks/use-discovery";
import type { DiscoveryKind, UbcFilter } from "@/types/api";

function PersonCardSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-12" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function emptyCopy(ubcFilter: UbcFilter) {
  if (ubcFilter === "ubc_verified") {
    return {
      title: "No UBC verified matches",
      body: "No verified UBC students match this list yet. Try Everyone or UBC students.",
    };
  }
  if (ubcFilter === "ubc_students") {
    return {
      title: "No UBC student matches",
      body: "No UBC students match this list yet. Try Everyone, or refine your profile.",
    };
  }
  return {
    title: "No matches here yet",
    body: "Refine your profile in AI Studio or check another tab as more people join.",
  };
}

export function DiscoveryPage() {
  const [kind, setKind] = useState<DiscoveryKind>("mutual");
  const [ubcFilter, setUbcFilter] = useState<UbcFilter>("all");
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiscovery(kind, ubcFilter);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const results = data?.pages.flatMap((p) => p.results) ?? [];
  const empty = emptyCopy(ubcFilter);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, kind, ubcFilter]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
      <header className="mb-8 space-y-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Find your people.
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Reciprocal matching from two embeddings: who you are, and who you&apos;re looking for.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <DiscoveryTabs value={kind} onChange={setKind} />
          <UbcFilterSelect value={ubcFilter} onChange={setUbcFilter} />
        </div>
      </header>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PersonCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load discovery results."}
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-20 text-center">
          <Users className="h-10 w-10 text-muted-foreground" />
          <p className="font-display text-lg font-medium">{empty.title}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{empty.body}</p>
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                showMutualBreakdown={kind === "mutual"}
              />
            ))}
          </div>
          <div ref={loadMoreRef} className="flex justify-center py-8">
            {isFetchingNextPage && (
              <p className="text-sm text-muted-foreground">Loading more…</p>
            )}
            {hasNextPage && !isFetchingNextPage && (
              <Button variant="ghost" onClick={() => void fetchNextPage()}>
                Load more
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
