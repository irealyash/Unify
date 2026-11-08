import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mutual — Find your people",
    template: "%s · Mutual",
  },
  description:
    "Enter a class code, answer a short working-style quiz, and get paired with classmates who work like you.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full font-sans antialiased">
        <Auth0Provider>
          <AppProviders>{children}</AppProviders>
        </Auth0Provider>
      </body>
    </html>
  );
}
