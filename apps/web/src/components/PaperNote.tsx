import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PaperNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto aspect-[5/3] w-full", className)}>
      <svg
        viewBox="0 0 500 300"
        className="absolute inset-0 h-full w-full overflow-visible drop-shadow-[4px_6px_0_rgba(60,75,129,0.25)]"
        aria-hidden="true"
      >
        {/* paper body: a rectangle with the bottom-left corner cut along the
            crease (34,210)-(104,280), leaving that corner bare */}
        <path
          d="M34,20 L466,20 L466,280 L104,280 L34,210 Z"
          className="fill-card"
        />
        {/* folded corner flap: the cut-off corner mirrored across the crease
            and laid back on top of the sheet, so its right angle points
            inward instead of out at the tip */}
        <path d="M34,210 L104,210 L104,280 Z" className="fill-clay" />
        {/* tape */}
        <rect
          x="190"
          y="0"
          width="120"
          height="46"
          transform="rotate(-6 250 23)"
          className="fill-secondary/80"
        />
      </svg>
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center text-card-foreground">
        {children}
      </div>
    </div>
  );
}
