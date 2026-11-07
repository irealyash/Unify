"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { UbcFilter } from "@/types/api";

const OPTIONS: { value: UbcFilter; label: string; description: string }[] = [
  {
    value: "all",
    label: "Everyone",
    description: "All matched people",
  },
  {
    value: "ubc_students",
    label: "UBC students",
    description: "Claimed or verified",
  },
  {
    value: "ubc_verified",
    label: "UBC verified",
    description: "Email-verified only",
  },
];

type UbcFilterSelectProps = {
  value: UbcFilter;
  onChange: (value: UbcFilter) => void;
  className?: string;
};

export function UbcFilterSelect({ value, onChange, className }: UbcFilterSelectProps) {
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition",
            "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "data-[state=open]:bg-muted/70",
            className,
          )}
        >
          <span className="text-muted-foreground">Show</span>
          <span>{current.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl border-border bg-popover p-1.5 shadow-md"
      >
        {OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange(option.value)}
              className={cn(
                "cursor-pointer gap-3 rounded-lg px-3 py-2.5 focus:bg-muted",
                selected && "bg-foreground text-background focus:bg-foreground focus:text-background",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{option.label}</p>
                <p
                  className={cn(
                    "text-xs",
                    selected ? "text-background/60" : "text-muted-foreground",
                  )}
                >
                  {option.description}
                </p>
              </div>
              {selected && <Check className="h-4 w-4 shrink-0" strokeWidth={2} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
