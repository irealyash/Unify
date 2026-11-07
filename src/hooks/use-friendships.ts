"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/client-api";
import type { FriendshipUiStatus } from "@/lib/profiles/public";

export type FriendshipRow = {
  id: string;
  status: string;
  uiStatus: FriendshipUiStatus;
  requestedBy: string;
  createdAt: string;
  otherUser: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
};

export function useFriendships() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["friendships"],
    queryFn: () => clientApi<{ friendships: FriendshipRow[] }>("/api/friendships"),
  });

  const sendRequest = useMutation({
    mutationFn: (toUserId: string) =>
      clientApi("/api/friendships", {
        method: "POST",
        body: JSON.stringify({ toUserId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships"] });
      void queryClient.invalidateQueries({ queryKey: ["discovery"] });
    },
  });

  const accept = useMutation({
    mutationFn: (id: string) => clientApi(`/api/friendships/${id}/accept`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["discovery"] });
    },
  });

  const decline = useMutation({
    mutationFn: (id: string) => clientApi(`/api/friendships/${id}/decline`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friendships"] });
      void queryClient.invalidateQueries({ queryKey: ["discovery"] });
    },
  });

  return { ...query, sendRequest, accept, decline };
}
