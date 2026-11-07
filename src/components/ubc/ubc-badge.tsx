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
        variant="outline"
        className={cn(
          "gap-1 border-foreground/20 bg-foreground text-[10px] font-medium text-background",
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
      variant="outline"
      className={cn(
        "gap-1 border-dashed text-[10px] font-normal text-muted-foreground",
        className,
      )}
    >
      <GraduationCap className="h-3 w-3 opacity-60" />
      UBC · unverified
    </Badge>
  );
}
