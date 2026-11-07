import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAppUserByClerkId, syncClerkBasics } from "@/lib/auth/current-user";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await syncClerkBasics();
  const appUser = await getAppUserByClerkId(userId);

  if (appUser?.username && appUser.profile?.onboardingCompletedAt) {
    redirect("/discover");
  }

  return children;
}
