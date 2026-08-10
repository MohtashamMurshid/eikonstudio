import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Copy } from "lucide-react";

const images = [
  {
    src: "/ai-image-japanese-garden.png",
    alt: "AI generated Japanese garden",
    className: "sm:col-span-2 sm:row-span-2",
    label: "Watercolor study",
  },
  {
    src: "/neon-city-rain.png",
    alt: "AI generated neon city",
    className: "",
    label: "Night system",
  },
  {
    src: "/ocean-cliffs-aerial.png",
    alt: "AI generated ocean cliffs",
    className: "",
    label: "Aerial frame",
  },
];

export function DetailedFeatures() {
  return (
    <>
      <section className="grid border-b border-foreground/10 lg:grid-cols-[1.28fr_0.72fr]">
        <div className="border-b border-foreground/10 p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="grid min-h-[480px] grid-cols-1 gap-px bg-foreground/10 sm:grid-cols-3 sm:grid-rows-2">
            {images.map((image, index) => (
              <div
                key={image.src}
                className={`group relative min-h-[220px] overflow-hidden bg-background ${image.className}`}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes={index === 0 ? "(max-width: 1024px) 100vw, 55vw" : "30vw"}
                  className="object-cover grayscale-[12%] transition-transform duration-500 [transition-timing-function:var(--ease-ui-out)] group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <p className="absolute inset-x-0 bottom-0 p-4 font-sans text-sm font-medium text-white">
                  {image.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between px-6 py-12 sm:px-10 lg:p-12">
          <div>
            <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-500">
              One connected library
            </p>
            <h2 className="mt-6 font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em]">
              Make it.{" "}
              <span className="font-script text-emerald-500">
                Keep it in reach.
              </span>
            </h2>
            <p className="mt-6 font-sans text-sm leading-6 text-foreground/50">
              Every completed job — image or video, from any of the six
              providers — lands in a durable gallery. Sort it, rename it, or
              reference it in the next prompt without breaking your flow.
            </p>
          </div>
          <div className="mt-10 space-y-3">
            {[
              "Folders that stay lightweight",
              "Fast @mentions in new prompts",
              "Generation history with metadata",
              "Full-resolution exports",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 text-[12px] text-foreground/55"
              >
                <Check className="size-3.5 text-emerald-500" strokeWidth={1.6} />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid border-b border-foreground/10 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="flex flex-col justify-between border-b border-foreground/10 px-6 py-12 sm:px-10 lg:border-b-0 lg:border-r lg:p-12">
          <div>
            <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-500">
              Developer interface
            </p>
            <h2 className="mt-6 font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em]">
              The engine,{" "}
              <span className="font-serif italic">
                wherever you build.
              </span>
            </h2>
            <p className="mt-6 max-w-[350px] font-sans text-sm leading-6 text-foreground/50">
              A documented REST endpoint and typed SDKs give your product the
              same provider-neutral contract used inside the studio.
            </p>
          </div>
          <Link
            href="/api-docs"
            className="ui-pressable group mt-10 inline-flex w-fit items-center gap-3 text-[9px] uppercase tracking-[0.15em] text-foreground/50 hover:text-foreground"
          >
            Read API docs
            <ArrowRight
              className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </Link>
        </div>

        <div className="bg-[#07110e] p-5 text-white sm:p-8 lg:p-12">
          <div className="overflow-hidden border border-white/10 bg-[#030806]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-[8px] uppercase tracking-[0.18em] text-white/40">
                POST /api/v1/generate
              </span>
              <Copy className="size-3 text-white/30" strokeWidth={1.5} />
            </div>
            <pre className="overflow-x-auto p-5 text-[10px] leading-6 text-white/62 sm:p-7 sm:text-xs">
              <code>
                <span className="text-emerald-400">const</span>{" "}
                <span className="text-white">image</span> ={" "}
                <span className="text-emerald-400">await</span> fetch(
                <span className="text-[#d8f3e7]">
                  &quot;/api/v1/generate&quot;
                </span>
                , {"{"}
                {"\n  "}method:{" "}
                <span className="text-[#d8f3e7]">&quot;POST&quot;</span>,
                {"\n  "}body: JSON.stringify({"{"}
                {"\n    "}prompt:{" "}
                <span className="text-[#d8f3e7]">
                  &quot;Editorial product study,
                  {"\n      "}soft morning light&quot;
                </span>
                ,
                {"\n    "}imageSize:{" "}
                <span className="text-[#d8f3e7]">&quot;4K&quot;</span>,
                {"\n    "}aspectRatio:{" "}
                <span className="text-[#d8f3e7]">&quot;landscape&quot;</span>
                {"\n  "}
                {"})"}
                {"\n"}
                {"}"});
              </code>
            </pre>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-20 text-center sm:px-10 sm:py-28">
        <div className="landing-radial absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-[760px]">
          <p className="text-[8px] uppercase tracking-[0.2em] text-emerald-500">
            Your keys. Your models. Your studio.
          </p>
          <h2 className="mt-7 font-sans text-[clamp(2.5rem,5.6vw,5.2rem)] font-medium leading-[0.94] tracking-[-0.06em]">
            Turn the idea{" "}
            <span className="font-script text-emerald-500">into an image.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-[520px] font-sans text-sm leading-6 text-foreground/50">
            Connect a provider key and start with a prompt. Leave with
            something durable, priced transparently, and yours to keep.
          </p>
          <Link
            href="/studio/create"
            className="ui-pressable group mt-9 inline-flex h-12 items-center gap-10 bg-emerald-500 px-6 text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-950 hover:bg-emerald-400"
          >
            Launch Eikon
            <ArrowRight
              className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </Link>
        </div>
      </section>
    </>
  );
}
