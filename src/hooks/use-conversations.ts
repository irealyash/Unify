"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/client-api";

export type ConversationListItem = {
  id: string;
  updatedAt: string;
  unreadCount: number;
  otherUser: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => clientApi<{ conversations: ConversationListItem[] }>("/api/conversations"),
  });
}

export function useConversationMessages(conversationId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () =>
      clientApi<{ messages: ChatMessage[] }>(`/api/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
  });

  const send = useMutation({
    mutationFn: (content: string) =>
      clientApi<{ message: ChatMessage }>(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  return { ...query, send };
}
