"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UbcFilter } from "@/types/api";

const OPTIONS: { value: UbcFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "ubc_students", label: "UBC students" },
  { value: "ubc_verified", label: "UBC verified" },
];

type UbcFilterSelectProps = {
  value: UbcFilter;
  onChange: (value: UbcFilter) => void;
  className?: string;
};

export function UbcFilterSelect({ value, onChange, className }: UbcFilterSelectProps) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <label htmlFor="ubc-filter" className="sr-only">
        Filter by UBC status
      </label>
      <select
        id="ubc-filter"
        value={value}
        onChange={(e) => onChange(e.target.value as UbcFilter)}
        className="h-10 appearance-none rounded-xl border border-border bg-card pl-4 pr-10 text-sm font-medium text-foreground outline-none transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
