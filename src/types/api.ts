import type { FriendshipUiStatus } from "@/lib/profiles/public";

export type DiscoveryKind = "you_might_like" | "might_like_you" | "mutual";

export type DiscoveryPerson = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  publicSummary: string;
  interests: string[];
  skills: string[];
  isUbcStudentClaim: boolean;
  isUbcVerified: boolean;
  friendshipStatus: FriendshipUiStatus;
  friendshipId?: string | null;
  score: number;
  scoreAB?: number;
  scoreBA?: number;
};

export type AssistantSide = "self" | "seeking";

export type AssistantHistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string | Date;
};
