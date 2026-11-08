import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-4 px-5 py-6 text-[12.5px] text-muted-foreground sm:flex-row sm:items-center md:px-6">
        <BrandLogo />
        <p>© {new Date().getFullYear()} Mutual</p>
        <ThemeToggle />
      </div>
    </footer>
  );
}
