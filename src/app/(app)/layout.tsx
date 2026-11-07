import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAppUserByClerkId, syncClerkBasics } from "@/lib/auth/current-user";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await syncClerkBasics();
  const appUser = await getAppUserByClerkId(userId);

  if (!appUser?.profile?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
