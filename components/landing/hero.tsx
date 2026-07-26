import Link from "next/link";
import { ArrowRight, Braces, Images, ScanLine, Sparkles } from "lucide-react";
import { TechnicalVisual } from "./technical-visual";

const specs = [
  { label: "Models", value: "02" },
  { label: "Resolution", value: "1K—4K" },
  { label: "Ratios", value: "08" },
  { label: "Assets", value: "∞" },
];

export function Hero() {
  return (
    <section className="grid min-h-[680px] border-b border-foreground/15 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="flex min-w-0 flex-col border-foreground/15 lg:border-r">
        <div className="flex-1 px-6 pb-12 pt-10 sm:px-10 sm:pb-14 sm:pt-14 lg:px-12 lg:pt-16">
          <p className="mb-10 text-[8px] uppercase tracking-[0.2em] text-foreground/42">
            Personal image workshop / 2026 / one canvas
          </p>

          <h1 className="max-w-[650px] font-sans text-[clamp(2.7rem,6vw,5.4rem)] font-medium leading-[0.91] tracking-[-0.07em]">
            Build images
            <br />
            that feel <span className="text-emerald-500">exact.</span>
          </h1>

          <p className="mt-8 max-w-[520px] font-sans text-[15px] leading-7 text-foreground/58 sm:text-base">
            Eikon is a focused AI workshop for generating, transforming, and
            organizing visual ideas—with enough control to take them all the
            way to production.
          </p>

          <div className="mt-9 grid max-w-[560px] grid-cols-2 border border-foreground/15 sm:grid-cols-4">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className="border-b border-r border-foreground/15 p-3 last:border-r-0 sm:border-b-0"
              >
                <p className="text-[7px] uppercase tracking-[0.16em] text-foreground/35">
                  {spec.label}
                </p>
                <p className="mt-1.5 text-[11px] font-medium tracking-tight">
                  {spec.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/studio/create"
              className="ui-pressable group inline-flex h-11 items-center gap-8 bg-emerald-500 px-5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-950 hover:bg-emerald-400"
            >
              Enter the workshop
              <ArrowRight
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={1.5}
              />
            </Link>
            <Link
              href="#process"
              className="ui-pressable inline-flex h-11 items-center border border-foreground/15 px-5 text-[9px] uppercase tracking-[0.14em] hover:bg-foreground/[0.035]"
            >
              See how it works
            </Link>
          </div>
        </div>

        <div className="grid border-t border-foreground/15 sm:grid-cols-[1.05fr_0.95fr]">
          <div className="px-6 py-5 sm:border-r sm:border-foreground/15 sm:px-10 lg:px-12">
            <p className="text-[7px] uppercase tracking-[0.16em] text-emerald-500">
              Maker&apos;s note
            </p>
            <p className="mt-2 max-w-[320px] text-[9px] leading-[1.65] text-foreground/47">
              One quiet place to prompt, edit, compare, and keep the work that
              matters. No tab maze required.
            </p>
          </div>
          <div className="border-t border-foreground/15 p-4 sm:border-t-0">
            {[
              [Sparkles, "Image engine", "Ready"],
              [Images, "Asset library", "Synced"],
              [Braces, "Developer API", "Online"],
              [ScanLine, "Render queue", "00 waiting"],
            ].map(([Icon, label, value]) => {
              const IconComponent = Icon as typeof Sparkles;
              return (
                <div
                  key={String(label)}
                  className="flex items-center justify-between border-b border-foreground/10 py-1.5 last:border-b-0"
                >
                  <span className="flex items-center gap-2 text-[7px] uppercase tracking-[0.12em] text-foreground/38">
                    <IconComponent className="size-2.5" strokeWidth={1.5} />
                    {String(label)}
                  </span>
                  <span className="text-[7px] uppercase tracking-[0.12em] text-emerald-500">
                    {String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TechnicalVisual />
    </section>
  );
}
