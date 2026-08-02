import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TechnicalVisual } from "./technical-visual";

export function Hero() {
  return (
    <section className="grid min-h-[560px] border-b border-foreground/10 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="flex min-w-0 flex-col justify-center border-foreground/10 lg:border-r">
        <div className="px-6 py-14 sm:px-10 sm:py-16 lg:px-12 lg:py-20">
          <p className="mb-8 text-[8px] uppercase tracking-[0.2em] text-foreground/40">
            Eikon Studio · Self-hosted
          </p>

          <h1 className="max-w-[650px] font-sans text-[clamp(2.7rem,5vw,4.25rem)] font-medium leading-[0.91] tracking-[-0.07em]">
            Open source
            <br />
            image and{" "}
            <span className="text-emerald-500">video harness.</span>
          </h1>

          <p className="mt-6 max-w-[380px] font-sans text-[15px] leading-7 text-foreground/55 sm:text-base">
            Generate, edit, and organize visual AI — self-hosted, with your own
            keys.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/studio/create"
              className="ui-pressable group inline-flex h-11 items-center gap-6 bg-emerald-500 px-5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-950 hover:bg-emerald-400"
            >
              Open Studio
              <ArrowRight
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={1.5}
              />
            </Link>
            <Link
              href="#capabilities"
              className="ui-pressable text-[9px] uppercase tracking-[0.14em] text-foreground/45 underline-offset-4 hover:text-foreground hover:underline"
            >
              View capabilities
            </Link>
          </div>
        </div>
      </div>

      <TechnicalVisual />
    </section>
  );
}
