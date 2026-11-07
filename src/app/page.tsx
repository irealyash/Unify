"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(255,255,255,0.12), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 75% 50% at 50% 0%, black 10%, transparent 70%)",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[12%] h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[110px]"
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.04, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-black">
            M
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Mutual</span>
        </Link>
        <Link
          href="/sign-in"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 backdrop-blur transition hover:border-white/30 hover:bg-white/10"
        >
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col items-center justify-center px-6 pb-28 text-center md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white font-display text-2xl font-bold text-black shadow-[0_0_48px_rgba(255,255,255,0.2)]"
          >
            M
          </motion.span>

          <h1 className="font-display text-[clamp(3.5rem,11vw,6rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
            Mutual
          </h1>

          <p className="mt-6 max-w-md text-balance text-base text-white/50 md:text-lg">
            Discover people who align with who you are—and who you want to become.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-10"
          >
            <Link
              href="/sign-in"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              Continue with Google
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[36vh] overflow-hidden"
          aria-hidden
        >
          <div
            className="mx-auto h-full max-w-4xl rounded-t-[1.75rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent"
            style={{
              maskImage: "linear-gradient(to bottom, black 25%, transparent 95%)",
            }}
          >
            <div className="flex h-11 items-center gap-2 border-b border-white/10 px-5">
              <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
              <div className="ml-4 h-1.5 w-24 rounded-full bg-white/15" />
            </div>
            <div className="grid grid-cols-3 gap-3 p-5 opacity-80">
              {[91, 84, 77].map((score, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left"
                >
                  <div className="mb-3 h-8 w-8 rounded-full bg-white/20" />
                  <div className="mb-2 h-2 w-14 rounded-full bg-white/25" />
                  <div className="h-2 w-20 rounded-full bg-white/10" />
                  <div className="mt-4 text-xs text-white/55">{score}% match</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
