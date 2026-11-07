"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/lib/client-api";

export type ProfileResponse = {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isUbcStudentClaim: boolean;
    isUbcVerified: boolean;
    interests: string[] | null;
    skills: string[] | null;
  };
  profile: {
    publicSummary: string;
    selfText: string;
    seekingText: string;
    selfVersion: number;
    seekingVersion: number;
    onboardingCompletedAt: string | null;
    embeddingModel: string;
  } | null;
};

export function useProfile() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () => clientApi<ProfileResponse>("/api/profile"),
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      clientApi("/api/profile", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });

  return { ...query, patch };
}
