import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#050505] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(20,184,166,0.18), transparent 60%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-sm font-bold text-black">
            M
          </span>
          <span className="text-sm font-semibold tracking-tight">Mutual</span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-white/55">
              Continue with Google to find your people.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-1 shadow-2xl">
            <SignIn
              routing="path"
              path="/sign-in"
              forceRedirectUrl="/onboarding"
              fallbackRedirectUrl="/onboarding"
              signUpForceRedirectUrl="/onboarding"
              appearance={{
                variables: {
                  colorPrimary: "#0F766E",
                  borderRadius: "0.75rem",
                },
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border-0 bg-white",
                  footer: "hidden",
                },
              }}
            />
          </div>
          <p className="mt-6 text-center text-xs text-white/40">
            Google is the only sign-in method.
          </p>
        </div>
      </main>
    </div>
  );
}
