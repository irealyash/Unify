"use client";

import { AiProfileStudio, AiStudioToggle } from "@/components/ai/ai-profile-studio";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useProfile } from "@/hooks/use-profile";
import { useAblyUserChannel } from "@/hooks/use-ably";
import { useQueryClient } from "@tanstack/react-query";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const userId = profile?.user.id ?? null;

  useAblyUserChannel(userId, (event) => {
    if (event === "notification") {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (event === "message") {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-border px-4 lg:px-6">
          <AiStudioToggle />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-0">{children}</main>
      </div>
      <AiProfileStudio />
    </div>
  );
}
