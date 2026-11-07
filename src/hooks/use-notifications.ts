"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/client-api";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  actorId: string | null;
};

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      clientApi<{ notifications: AppNotification[]; unreadCount: number }>("/api/notifications"),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) =>
      clientApi("/api/notifications/read", {
        method: "POST",
        body: JSON.stringify(ids?.length ? { ids } : {}),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return { ...query, markRead };
}
