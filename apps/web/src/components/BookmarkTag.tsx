import { cn } from "@/lib/utils";

export function BookmarkTag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 116"
      className={cn(
        "fill-accent drop-shadow-[2px_3px_0_rgba(60,75,129,0.25)]",
        className,
      )}
      aria-hidden="true"
    >
      <path d="M18,0 L82,0 A18,18 0 0 1 100,18 L100,116 L50,86 L0,116 L0,18 A18,18 0 0 1 18,0 Z" />
    </svg>
  );
}
