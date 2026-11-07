"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { clientApi } from "@/lib/client-api";
import type { DiscoveryKind, DiscoveryPerson } from "@/types/api";

const PAGE_SIZE = 20;

type DiscoveryResponse = {
  kind: DiscoveryKind;
  results: DiscoveryPerson[];
};

export function useDiscovery(kind: DiscoveryKind) {
  return useInfiniteQuery({
    queryKey: ["discovery", kind],
    queryFn: async ({ pageParam = 0 }) =>
      clientApi<DiscoveryResponse>(
        `/api/discovery?kind=${encodeURIComponent(kind)}&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.results.length < PAGE_SIZE) return undefined;
      return allPages.reduce((acc, p) => acc + p.results.length, 0);
    },
  });
}
