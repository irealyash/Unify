"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% -15%, rgba(20,184,166,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 85% 20%, rgba(255,255,255,0.06), transparent 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 80% 55% at 50% 0%, black 20%, transparent 75%)",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[18%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[100px]"
        animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-400 text-sm font-bold text-black">
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

      {/* Hero — one composition */}
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col items-center justify-center px-6 pb-24 text-center md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-400 font-display text-2xl font-bold text-black shadow-[0_0_40px_rgba(45,212,191,0.35)]"
          >
            M
          </motion.span>

          <h1 className="font-display text-[clamp(3.25rem,10vw,5.75rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
            Mutual
          </h1>

          <p className="mt-6 max-w-md text-balance text-base text-white/55 md:text-lg">
            Discover people who align with who you are—and who you want to become.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="mt-10"
          >
            <Link
              href="/sign-in"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-teal-50"
            >
              Continue with Google
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Soft product silhouette — full-bleed visual plane, not a card collage */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] overflow-hidden"
          aria-hidden
        >
          <div
            className="mx-auto h-full max-w-4xl rounded-t-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent"
            style={{
              maskImage: "linear-gradient(to bottom, black 30%, transparent 95%)",
            }}
          >
            <div className="flex h-12 items-center gap-2 border-b border-white/10 px-5">
              <div className="h-2 w-2 rounded-full bg-white/25" />
              <div className="h-2 w-2 rounded-full bg-white/25" />
              <div className="h-2 w-2 rounded-full bg-white/25" />
              <div className="ml-4 h-2 w-28 rounded-full bg-white/10" />
            </div>
            <div className="grid grid-cols-3 gap-3 p-5 opacity-70">
              {[72, 88, 64].map((score, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left"
                >
                  <div className="mb-3 h-8 w-8 rounded-full bg-teal-400/30" />
                  <div className="mb-2 h-2 w-16 rounded-full bg-white/20" />
                  <div className="h-2 w-24 rounded-full bg-white/10" />
                  <div className="mt-4 text-xs text-teal-300/80">{score}% match</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
