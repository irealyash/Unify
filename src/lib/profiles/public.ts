import type { User, UserProfile } from "@/lib/db/schema";

export type FriendshipUiStatus =
  | "NONE"
  | "PENDING_OUTGOING"
  | "PENDING_INCOMING"
  | "FRIENDS"
  | "DECLINED"
  | "BLOCKED";

export type PublicPerson = {
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
};

export function toPublicPerson(
  user: Pick<
    User,
    | "id"
    | "username"
    | "displayName"
    | "avatarUrl"
    | "interests"
    | "skills"
    | "isUbcStudentClaim"
    | "isUbcVerified"
  >,
  profile: Pick<UserProfile, "publicSummary"> | null | undefined,
  friendship?: { status: FriendshipUiStatus; friendshipId?: string | null },
): PublicPerson {
  return {
    id: user.id,
    username: user.username!,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    publicSummary: profile?.publicSummary || "",
    interests: user.interests ?? [],
    skills: user.skills ?? [],
    isUbcStudentClaim: user.isUbcStudentClaim,
    isUbcVerified: user.isUbcVerified,
    friendshipStatus: friendship?.status ?? "NONE",
    friendshipId: friendship?.friendshipId ?? null,
  };
}
