"use client";

const FEATURES = [
  { title: "Smart matching", body: "By working style, not chance." },
  { title: "Private rooms", body: "Code-gated class pools." },
  { title: "Shared biomes", body: "Land with similar classmates." },
  { title: "Less friction", body: "Skip the spreadsheet scramble." },
] as const;

export function FeatureStrip() {
  return (
    <section className="shrink-0 border-t border-border">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-0 px-5 md:grid-cols-4 md:px-6">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="border-border px-0 py-3 md:border-r md:px-4 md:py-3.5 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
          >
            <h3 className="text-[12px] font-medium tracking-tight text-foreground">
              {feature.title}
            </h3>
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
              {feature.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
