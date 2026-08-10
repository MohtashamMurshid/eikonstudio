import Image from "next/image";
import { ArrowDownRight, Check, KeyRound, Sparkles } from "lucide-react";

const steps = [
  { number: "01", title: "Connect", copy: "Add the provider keys you already own.", icon: KeyRound },
  { number: "02", title: "Create", copy: "Move between image and video models.", icon: Sparkles },
  { number: "03", title: "Keep", copy: "Every result lands in one durable library.", icon: Check },
];

export function Stats() {
  return (
    <section id="process" className="px-2 pb-2 sm:px-3 sm:pb-3">
      <div className="mx-auto grid min-h-[760px] max-w-[1480px] gap-2 sm:gap-3 lg:h-[88svh] lg:min-h-[680px] lg:grid-cols-2">
        <div className="relative flex min-h-[560px] flex-col justify-end overflow-hidden rounded-2xl bg-card px-6 py-8 sm:px-10 sm:py-10 lg:min-h-0">
          <div className="hero-dots absolute inset-0 opacity-80" aria-hidden="true" />
          <div className="relative max-w-[520px]">
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/12 px-3 py-2 font-sans text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="size-3.5" />
              One creative loop
            </span>
            <h2 className="mt-6 font-sans text-[clamp(2.35rem,4.3vw,4.7rem)] font-light leading-[1.02] tracking-[-0.055em] text-foreground/65">
              From a key to a finished frame, without changing tools.
            </h2>
            <p className="mt-6 max-w-[440px] font-sans text-sm leading-6 text-foreground/48">
              Eikon keeps the machinery out of the way. Pick a model, describe the idea, and keep the result close for the next pass.
            </p>
            <a href="#capabilities" className="ui-pressable mt-8 inline-flex size-11 items-center justify-center rounded-xl border border-foreground/10 bg-card text-foreground/55 hover:bg-foreground/[0.04] hover:text-foreground" aria-label="See capabilities">
              <ArrowDownRight className="size-4" strokeWidth={1.6} />
            </a>
          </div>
        </div>

        <div className="relative min-h-[620px] overflow-hidden rounded-2xl lg:min-h-0">
          <Image src="/ai-image-japanese-garden.png" alt="A generated Japanese garden" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />

          <div className="absolute left-5 top-1/2 w-[calc(100%+90px)] -translate-y-1/2 sm:left-10 sm:w-[calc(100%+140px)]">
            <div className="rounded-2xl border border-white/35 bg-white/92 p-3 shadow-[0_50px_100px_-35px_rgba(0,0,0,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/90">
              <div className="flex items-center justify-between border-b border-border px-3 pb-3 pt-1">
                <div>
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-300">How it flows</p>
                  <p className="mt-1 font-sans text-sm font-semibold tracking-[-0.02em]">Three steps. No handoff.</p>
                </div>
                <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 font-sans text-[8px] font-semibold text-emerald-700 dark:text-emerald-300">Live workflow</span>
              </div>
              <div className="grid gap-2 pt-3 sm:grid-cols-3">
                {steps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <article key={step.number} className="min-h-[190px] rounded-xl bg-muted p-4 sm:min-h-[230px]">
                      <div className="flex items-center justify-between">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-card text-emerald-600 shadow-sm dark:text-emerald-300"><Icon className="size-3.5" strokeWidth={1.7} /></span>
                        <span className="font-sans text-[9px] font-semibold text-foreground/25">{step.number}</span>
                      </div>
                      <div className="mt-16 sm:mt-24">
                        <h3 className="font-sans text-base font-semibold tracking-[-0.03em]">{step.title}</h3>
                        <p className="mt-2 max-w-[150px] font-sans text-[10px] leading-4 text-foreground/45">{step.copy}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
