import Image from "next/image";
import Link from "next/link";
import { Aperture, ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="lg:grid lg:h-[calc(100svh-60px)] lg:grid-rows-[70%_30%]">
      <div className="relative h-[360px] w-full overflow-hidden bg-[#151511] sm:h-[440px] lg:h-auto lg:min-h-0">
        <Image
          src="/eikon-roman-camera-hero.png"
          alt="A small modern camera resting within an engraved Roman loggia overlooking the Mediterranean"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[58%_54%]"
        />
        <div className="hero-print-overlay absolute inset-0" aria-hidden="true" />
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-[#f4d17a]/30 bg-black/35 px-3 py-1.5 text-[9px] uppercase tracking-[0.16em] text-[#f5d886] backdrop-blur-sm sm:bottom-6 sm:left-8">
          <Aperture className="size-3" strokeWidth={1.5} />
          Rome, imagined / frame 01
        </div>
      </div>

      <div className="grid lg:min-h-0 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="flex items-center px-6 py-8 sm:px-10 lg:min-h-0 lg:px-12 lg:py-5 xl:px-16">
          <h1 className="max-w-[650px] font-display text-[clamp(3rem,5vw,5.4rem)] font-medium leading-[0.82] tracking-[-0.055em]">
            Give every idea
            <br />
            a point of view.
          </h1>
        </div>

        <div className="flex items-center px-6 py-8 sm:px-10 lg:min-h-0 lg:px-10 lg:py-5 xl:px-14">
          <div className="max-w-[430px]">
            <p className="landing-copy font-sans text-[16px] leading-7 tracking-[-0.025em] sm:text-[18px]">
              Explore image and video models, compare their work, and ship through
              one open platform—using your own provider keys.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/studio/create"
                className="ui-pressable landing-inverse group inline-flex h-11 items-center gap-3 rounded-full px-5 font-sans text-[13px] font-semibold hover:opacity-80"
              >
                <Sparkles className="size-4" strokeWidth={1.7} />
                Open studio
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </Link>
              <Link
                href="#features"
                className="ui-pressable landing-soft inline-flex h-11 items-center rounded-full px-5 font-sans text-[13px] font-semibold"
              >
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
