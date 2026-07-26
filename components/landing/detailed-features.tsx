import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Copy } from "lucide-react";

const images = [
  {
    src: "/ai-image-japanese-garden.png",
    alt: "AI generated Japanese garden",
    className: "sm:col-span-2 sm:row-span-2",
    label: "Watercolor study",
    ratio: "16:9",
  },
  {
    src: "/neon-city-rain.png",
    alt: "AI generated neon city",
    className: "",
    label: "Night system",
    ratio: "1:1",
  },
  {
    src: "/ocean-cliffs-aerial.png",
    alt: "AI generated ocean cliffs",
    className: "",
    label: "Aerial frame",
    ratio: "4:3",
  },
];

export function DetailedFeatures() {
  return (
    <>
      <section className="grid border-b border-foreground/15 lg:grid-cols-[1.28fr_0.72fr]">
        <div className="border-b border-foreground/15 p-4 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="grid min-h-[520px] grid-cols-1 gap-px bg-foreground/15 sm:grid-cols-3 sm:grid-rows-2">
            {images.map((image, index) => (
              <div
                key={image.src}
                className={`group relative min-h-[230px] overflow-hidden bg-background ${image.className}`}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes={index === 0 ? "(max-width: 1024px) 100vw, 55vw" : "30vw"}
                  className="object-cover grayscale-[18%] transition-transform duration-500 [transition-timing-function:var(--ease-ui-out)] group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white">
                  <div>
                    <p className="text-[7px] uppercase tracking-[0.16em] text-white/55">
                      Output {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-1 font-sans text-sm font-medium">
                      {image.label}
                    </p>
                  </div>
                  <span className="text-[7px] uppercase tracking-[0.14em] text-white/60">
                    {image.ratio}
                  </span>
                </div>
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
              Make it.
              <br />
              Keep it in reach.
            </h2>
            <p className="mt-6 font-sans text-sm leading-6 text-foreground/50">
              Every useful generation lands in a gallery built for iteration.
              Sort it, rename it, or reference it in the next idea without
              breaking your flow.
            </p>
          </div>
          <div className="mt-12 border-t border-foreground/15">
            {[
              "Folders that stay lightweight",
              "Fast @mentions in new prompts",
              "Generation history with metadata",
              "Full-resolution exports",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 border-b border-foreground/15 py-3 text-[9px] text-foreground/58"
              >
                <Check className="size-3 text-emerald-500" strokeWidth={1.6} />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid border-b border-foreground/15 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="flex flex-col justify-between border-b border-foreground/15 px-6 py-12 sm:px-10 lg:border-b-0 lg:border-r lg:p-12">
          <div>
            <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-500">
              Developer interface
            </p>
            <h2 className="mt-6 font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em]">
              The engine,
              <br />
              wherever you build.
            </h2>
            <p className="mt-6 max-w-[350px] font-sans text-sm leading-6 text-foreground/50">
              A clean REST endpoint gives your product the same image system
              used inside the studio.
            </p>
          </div>
          <Link
            href="/api-docs"
            className="ui-pressable group mt-10 inline-flex w-fit items-center gap-8 border border-foreground/15 px-5 py-3 text-[8px] uppercase tracking-[0.15em] hover:bg-foreground/[0.035]"
          >
            Read API docs
            <ArrowRight
              className="size-3 transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </Link>
        </div>

        <div className="bg-[#07110e] p-4 text-white sm:p-8 lg:p-12">
          <div className="overflow-hidden border border-white/15 bg-[#030806]">
            <div className="flex items-center justify-between border-b border-white/12 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="size-1.5 bg-emerald-400" />
                <span className="text-[7px] uppercase tracking-[0.18em] text-white/45">
                  POST /api/v1/generate
                </span>
              </div>
              <Copy className="size-3 text-white/35" strokeWidth={1.5} />
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
                <span className="text-[#d8f3e7]">&quot;16:9&quot;</span>
                {"\n  "}
                {"})"}
                {"\n"}
                {"}"});
              </code>
            </pre>
            <div className="grid grid-cols-3 border-t border-white/12">
              {[
                ["Status", "200 OK"],
                ["Format", "JSON"],
                ["Latency", "~4.2s"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-r border-white/12 px-4 py-3 last:border-r-0"
                >
                  <p className="text-[6px] uppercase tracking-[0.14em] text-white/28">
                    {label}
                  </p>
                  <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-emerald-400">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-20 text-center sm:px-10 sm:py-28">
        <div className="landing-radial absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-[760px]">
          <p className="text-[8px] uppercase tracking-[0.2em] text-emerald-500">
            Your next frame starts here
          </p>
          <h2 className="mt-7 font-sans text-[clamp(2.7rem,6vw,5.8rem)] font-medium leading-[0.9] tracking-[-0.07em]">
            Turn the idea into an image.
          </h2>
          <p className="mx-auto mt-7 max-w-[520px] font-sans text-sm leading-6 text-foreground/50">
            Start with a prompt. Leave with something you can actually use.
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
