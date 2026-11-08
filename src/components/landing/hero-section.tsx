"use client";

import { motion, useReducedMotion } from "framer-motion";
import { JoinSessionCard, type JoinUser } from "@/components/landing/join-session-card";
import { MatchingIllustration } from "@/components/landing/matching-illustration";

type Props = {
  user: JoinUser | undefined;
  code: string;
  officialName: string;
  loading: boolean;
  codeError?: string | null;
  nameError?: string | null;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function HeroSection(props: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative flex min-h-0 flex-1 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="landing-panorama pointer-events-none absolute inset-[-8%]">
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/lecture-hall-bg.jpg)" }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-background/88" />
      </div>

      <div className="relative z-10 mx-auto grid h-full w-full max-w-5xl grid-cols-1 content-center gap-6 px-5 py-4 md:grid-cols-[1fr_1.05fr] md:items-center md:gap-10 md:px-6 md:py-5">
        <div className="max-w-md">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="text-label"
          >
            Team formation, reimagined
          </motion.p>

          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.03, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2.5 text-[clamp(1.75rem,3.2vh+1rem,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground"
          >
            Find your people.
            <br />
            Build better teams.
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground"
          >
            Meet classmates who complement your skills, ambitions and working
            style.
          </motion.p>

          <div className="relative z-20 mt-5">
            <JoinSessionCard {...props} />
          </div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none hidden h-[min(52vh,420px)] md:block"
          aria-hidden
        >
          <MatchingIllustration className="h-full w-full overflow-hidden rounded-lg border border-border bg-card" />
        </motion.div>
      </div>
    </section>
  );
}
