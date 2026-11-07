"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { clientApi } from "@/lib/client-api";
import type { DiscoveryKind, DiscoveryPerson, UbcFilter } from "@/types/api";

const PAGE_SIZE = 20;

type DiscoveryResponse = {
  kind: DiscoveryKind;
  ubcFilter: UbcFilter;
  results: DiscoveryPerson[];
};

export function useDiscovery(kind: DiscoveryKind, ubcFilter: UbcFilter = "all") {
  return useInfiniteQuery({
    queryKey: ["discovery", kind, ubcFilter],
    queryFn: async ({ pageParam = 0 }) =>
      clientApi<DiscoveryResponse>(
        `/api/discovery?kind=${encodeURIComponent(kind)}&ubc=${encodeURIComponent(ubcFilter)}&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.results.length < PAGE_SIZE) return undefined;
      return allPages.reduce((acc, p) => acc + p.results.length, 0);
    },
  });
}
