"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/client-api";
import type { AssistantHistoryMessage, AssistantSide } from "@/types/api";

type AssistantState = {
  history: AssistantHistoryMessage[];
  profileText: string;
  version: number;
};

type SendResult = {
  assistantMessage: string;
  shouldUpdate: boolean;
  changesSummary: string[];
  version: number;
  publicSummary: string;
  side: AssistantSide;
  updatedProfile: string | null;
};

function endpoint(side: AssistantSide) {
  return side === "self" ? "/api/assistant/self" : "/api/assistant/seeking";
}

export function useAssistant(side: AssistantSide) {
  const queryClient = useQueryClient();
  const queryKey = ["assistant", side];

  const query = useQuery({
    queryKey,
    queryFn: () => clientApi<AssistantState>(endpoint(side)),
  });

  const send = useMutation({
    mutationFn: (message: string) =>
      clientApi<SendResult>(endpoint(side), {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (result.shouldUpdate) {
        // V_self changes affect "might like you" + mutual; V_seeking affects "you might like" + mutual
        if (side === "self") {
          void queryClient.invalidateQueries({
            queryKey: ["discovery", "might_like_you"],
          });
          void queryClient.invalidateQueries({ queryKey: ["discovery", "mutual"] });
        } else {
          void queryClient.invalidateQueries({
            queryKey: ["discovery", "you_might_like"],
          });
          void queryClient.invalidateQueries({ queryKey: ["discovery", "mutual"] });
        }
      }
    },
  });

  const undo = useMutation({
    mutationFn: () =>
      clientApi(endpoint(side), {
        method: "DELETE",
        body: JSON.stringify({ action: "undo" }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (side === "self") {
        void queryClient.invalidateQueries({
          queryKey: ["discovery", "might_like_you"],
        });
        void queryClient.invalidateQueries({ queryKey: ["discovery", "mutual"] });
      } else {
        void queryClient.invalidateQueries({
          queryKey: ["discovery", "you_might_like"],
        });
        void queryClient.invalidateQueries({ queryKey: ["discovery", "mutual"] });
      }
    },
  });

  return { ...query, send, undo };
}
