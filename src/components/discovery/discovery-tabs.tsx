"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DiscoveryKind } from "@/types/api";

const TABS: { value: DiscoveryKind; label: string }[] = [
  { value: "mutual", label: "Mutual matches" },
  { value: "you_might_like", label: "You might like" },
  { value: "might_like_you", label: "Might like you" },
];

type DiscoveryTabsProps = {
  value: DiscoveryKind;
  onChange: (kind: DiscoveryKind) => void;
  className?: string;
};

export function DiscoveryTabs({ value, onChange, className }: DiscoveryTabsProps) {
  return (
    <div
      className={cn(
        "relative inline-flex rounded-xl border border-border bg-muted/50 p-1",
        className,
      )}
      role="tablist"
    >
      {TABS.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative z-10 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="discovery-tab-indicator"
                className="absolute inset-0 rounded-lg bg-card shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
