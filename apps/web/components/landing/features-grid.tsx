import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDot,
  Film,
  ImageIcon,
  SlidersHorizontal,
} from "lucide-react";

const models = [
  ["GPT Image", "Image · Generate + edit", "Ready"],
  ["FLUX", "Image · Generate + tools", "Ready"],
  ["Veo", "Video · Text + reference", "Preview"],
  ["Seedance", "Video · Image + motion", "Ready"],
] as const;

const comparisons = [
  {
    src: "/ai-image-japanese-garden.png",
    alt: "A warm Japanese garden image generated with AI",
    model: "Model A",
    detail: "2.8s · $0.04 est.",
  },
  {
    src: "/neon-city-rain.png",
    alt: "A neon city scene generated with AI",
    model: "Model B",
    detail: "4.1s · $0.08 est.",
  },
  {
    src: "/ocean-cliffs-aerial.png",
    alt: "An aerial ocean cliff image generated with AI",
    model: "Model C",
    detail: "3.4s · $0.06 est.",
  },
] as const;

export function FeaturesGrid() {
  return (
    <section id="features" className="landing-border border-b">
      <div className="landing-border grid border-b lg:grid-cols-[0.78fr_1.22fr]">
        <div className="landing-border flex flex-col justify-between border-b px-6 py-16 sm:px-10 lg:min-h-[660px] lg:border-b-0 lg:border-r lg:px-12 lg:py-20 xl:px-16">
          <div>
            <p className="landing-eyebrow flex items-center gap-2 font-sans text-[10px] uppercase tracking-[0.16em]">
              <CircleDot className="size-3.5" strokeWidth={1.5} />
              The model catalog
            </p>
            <h2 className="mt-8 max-w-[520px] font-display text-[clamp(3rem,4.7vw,5.5rem)] font-medium leading-[0.82] tracking-[-0.055em]">
              Choose the model.
              <br />
              Not the plumbing.
            </h2>
          </div>
          <div className="mt-12 max-w-[420px]">
            <p className="landing-copy font-sans text-[15px] leading-7">
              Search current image and video models by what they can do. Eikon
              keeps native capabilities visible while giving every model a
              consistent place to start.
            </p>
            <Link
              href="/models"
              className="ui-pressable landing-muted group mt-7 inline-flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.15em] hover:text-[var(--landing-ink)]"
            >
              Explore the catalog
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.5}
              />
            </Link>
          </div>
        </div>

        <div className="landing-soft flex items-center p-4 sm:p-8 lg:p-12 xl:p-16">
          <div className="landing-panel landing-border w-full overflow-hidden rounded-[28px] border shadow-[0_28px_80px_rgba(0,0,0,0.08)]">
            <div className="landing-border flex items-center justify-between border-b px-5 py-4 sm:px-7">
              <div>
                <p className="font-sans text-[11px] font-semibold tracking-[-0.02em]">
                  Model registry
                </p>
                <p className="landing-faint mt-1 font-sans text-[9px] uppercase tracking-[0.14em]">
                  Live discovery · Eikon normalized
                </p>
              </div>
              <SlidersHorizontal className="landing-muted size-4" strokeWidth={1.5} />
            </div>

            <div className="landing-border grid grid-cols-[1fr_auto] gap-3 border-b px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:px-7">
              <div className="landing-soft flex h-10 items-center rounded-full px-4 font-sans text-[11px]">
                Search models, families, capabilities…
              </div>
              <div className="landing-border hidden h-10 items-center gap-2 rounded-full border px-4 font-sans text-[10px] sm:flex">
                <ImageIcon className="size-3.5" strokeWidth={1.5} /> Image
              </div>
              <div className="landing-border flex h-10 items-center gap-2 rounded-full border px-4 font-sans text-[10px]">
                <Film className="size-3.5" strokeWidth={1.5} /> Video
              </div>
            </div>

            <div>
              {models.map(([name, capability, status], index) => (
                <div
                  key={name}
                  className={`landing-border grid grid-cols-[1fr_auto] items-center gap-5 px-5 py-5 sm:px-7 ${
                    index < models.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="landing-inverse flex size-8 shrink-0 items-center justify-center rounded-full font-display text-lg">
                        {name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-sans text-[13px] font-semibold tracking-[-0.02em]">
                          {name}
                        </h3>
                        <p className="landing-faint mt-1 truncate font-sans text-[10px]">
                          {capability}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span className="landing-soft flex items-center gap-2 rounded-full px-3 py-1.5 font-sans text-[9px] uppercase tracking-[0.1em]">
                    <span className="size-1.5 rounded-full bg-[#b39035]" />
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
        <div className="landing-border border-b p-3 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="grid min-h-[560px] grid-cols-1 gap-2 sm:grid-cols-3">
            {comparisons.map((item, index) => (
              <figure
                key={item.src}
                className={`group relative min-h-[280px] overflow-hidden bg-[#1b1b17] ${
                  index === 0 ? "sm:translate-y-8" : index === 2 ? "sm:-translate-y-5" : ""
                }`}
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 28vw"
                  className="object-cover saturate-[0.78] transition-transform duration-700 [transition-timing-function:var(--ease-ui-out)] group-hover:scale-[1.025]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
                <figcaption className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em]">
                    {item.model}
                  </p>
                  <p className="mt-1 font-sans text-[9px] text-white/55">{item.detail}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-12 lg:py-20 xl:px-16">
          <p className="landing-eyebrow font-sans text-[10px] uppercase tracking-[0.16em]">
            Sandbox comparison
          </p>
          <h2 className="mt-8 font-display text-[clamp(3rem,4vw,4.8rem)] font-medium leading-[0.83] tracking-[-0.05em]">
            See the difference before you commit.
          </h2>
          <p className="landing-copy mt-7 font-sans text-[14px] leading-7">
            Run one prompt through two to four models. Results stay independent,
            costs stay visible, and one failure never hides the work that finished.
          </p>
          <div className="mt-8 space-y-3">
            {["Shared normalized inputs", "Model-specific overrides", "Independent durable jobs"].map(
              (feature) => (
                <div key={feature} className="landing-muted flex items-center gap-3 font-sans text-[12px]">
                  <Check className="size-3.5" strokeWidth={1.6} />
                  {feature}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
