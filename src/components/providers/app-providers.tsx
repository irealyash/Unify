"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

const clerkAppearance = {
  variables: {
    colorPrimary: "#0F766E",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "mx-auto w-full",
    card: "shadow-md border border-[#e0ddd8] bg-white",
    headerTitle: "font-semibold",
    socialButtonsBlockButton: "border border-[#e0ddd8]",
  },
};

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
      afterSignOutUrl="/"
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "bg-card text-foreground border border-border shadow-md",
              },
            }}
            richColors
            closeButton
          />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
