import { GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type UbcBadgeProps = {
  claim: boolean;
  verified: boolean;
  className?: string;
};

export function UbcBadge({ claim, verified, className }: UbcBadgeProps) {
  if (!claim && !verified) return null;

  if (verified) {
    return (
      <Badge
        variant="accent"
        className={cn(
          "gap-1 border border-accent/30 bg-accent/15 font-medium text-accent",
          className,
        )}
      >
        <GraduationCap className="h-3 w-3" />
        UBC verified
      </Badge>
    );
  }

  return (
    <Badge
      variant="muted"
      className={cn("gap-1 font-normal text-muted-foreground", className)}
    >
      <GraduationCap className="h-3 w-3 opacity-60" />
      UBC student
    </Badge>
  );
}
