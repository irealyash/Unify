import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  markClassName,
  wordmark = true,
  href = "/",
}: {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 text-foreground", className)}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-[5px] bg-foreground text-[11px] font-semibold tracking-tight text-background",
          markClassName,
        )}
        aria-hidden
      >
        M
      </span>
      {wordmark ? (
        <span className="text-[14px] font-medium tracking-[-0.01em]">Mutual</span>
      ) : null}
    </Link>
  );
}
