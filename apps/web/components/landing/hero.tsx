import Link from "next/link";
import { Key, Sparkles } from "lucide-react";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  return (
    <section className="relative grid min-h-svh lg:h-svh lg:grid-cols-2 lg:overflow-hidden">
      <div className="relative flex min-w-0 flex-col justify-end overflow-hidden">
        <div className="hero-dots absolute inset-0" aria-hidden="true" />

        <div className="relative px-6 pb-12 pt-32 sm:px-10 sm:pb-14 lg:px-12 lg:pb-16">
          <h1 className="font-sans text-[clamp(1.9rem,3.1vw,3.1rem)] font-light leading-[1.22] tracking-[-0.02em] text-foreground/60">
            <span className="flex flex-wrap items-center gap-x-[0.35em] gap-y-3">
              <span>Turn</span>
              <span className="hero-pill hero-pill--violet">
                <span className="hero-pill__icon">
                  <Key className="size-[0.55em]" strokeWidth={2.4} />
                </span>
                your API keys
              </span>
              <span>into</span>
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-x-[0.35em] gap-y-3">
              <span>endless</span>
              <span className="hero-pill hero-pill--orange">
                <span className="hero-pill__icon">
                  <Sparkles className="size-[0.55em]" strokeWidth={2.4} />
                </span>
                production media
              </span>
            </span>
          </h1>

          <p className="mt-6 max-w-[440px] font-sans text-[15px] leading-6 text-foreground/60">
            Connect OpenAI, Google, Black Forest Labs, and more behind one
            contract — zero markup, self-hosted, on your own keys.
          </p>

          <div className="mt-8">
            <Link
              href="/studio/create"
              className="ui-pressable inline-flex h-11 items-center rounded-xl bg-emerald-500 px-5 font-sans text-[15px] font-medium text-white shadow-[0_10px_24px_-8px_rgba(16,185,129,0.7)] hover:bg-emerald-400"
            >
              Open the studio
            </Link>
          </div>
        </div>
      </div>

      <HeroVisual />
    </section>
  );
}
