import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Cloud, KeyRound, RefreshCcw } from "lucide-react";

const lifecycle = ["Queued", "Submitting", "Processing", "Persisting", "Completed"] as const;

export function DetailedFeatures() {
  return (
    <>
      <section id="process" className="landing-border border-b">
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="landing-border flex flex-col justify-between border-b px-6 py-16 sm:px-10 lg:min-h-[560px] lg:border-b-0 lg:border-r lg:px-12 lg:py-20 xl:px-16">
            <div>
              <p className="landing-eyebrow font-sans text-[10px] uppercase tracking-[0.16em]">
                Durable by default
              </p>
              <h2 className="mt-8 font-display text-[clamp(3rem,4.6vw,5.3rem)] font-medium leading-[0.82] tracking-[-0.055em]">
                Your work outlives the provider link.
              </h2>
            </div>
            <p className="landing-copy mt-12 max-w-[420px] font-sans text-[14px] leading-7">
              Every request becomes a durable job. Inputs, progress, errors, cost,
              and successful outputs stay inspectable after a refresh or redeploy.
            </p>
          </div>

          <div className="landing-soft flex items-center px-6 py-16 sm:px-10 lg:px-12 lg:py-20 xl:px-16">
            <div className="w-full">
              <div className="landing-panel landing-border rounded-[28px] border p-5 sm:p-8">
                <div className="landing-border flex items-center justify-between border-b pb-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-[#b39035]/15 text-[#a17f28]">
                      <RefreshCcw className="size-4" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="font-sans text-[12px] font-semibold">Generation gen_8A41</p>
                      <p className="landing-faint mt-1 font-sans text-[9px] uppercase tracking-[0.13em]">
                        Image · Web playground
                      </p>
                    </div>
                  </div>
                  <span className="landing-soft rounded-full px-3 py-1.5 font-sans text-[9px] uppercase tracking-[0.12em]">
                    Live
                  </span>
                </div>

                <div className="mt-8 grid gap-5 sm:grid-cols-5 sm:gap-2">
                  {lifecycle.map((step, index) => (
                    <div key={step} className="relative flex items-center gap-3 sm:block">
                      <div className="relative flex items-center sm:block">
                        <span
                          className={`relative z-10 block size-3 rounded-full ${
                            index < lifecycle.length - 1
                              ? "bg-[#b39035]"
                              : "bg-[var(--landing-ink)]"
                          }`}
                        />
                        {index < lifecycle.length - 1 ? (
                          <span className="landing-border absolute left-1.5 top-3 h-8 border-l sm:left-3 sm:top-1.5 sm:h-0 sm:w-[calc(100%+0.5rem)] sm:border-l-0 sm:border-t" />
                        ) : null}
                      </div>
                      <div className="sm:mt-4">
                        <p className="font-sans text-[10px] font-semibold">{step}</p>
                        <p className="landing-faint mt-1 font-sans text-[9px]">
                          {index === 4 ? "Stored" : `0${index + 1}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="landing-border mt-8 grid border-t pt-6 sm:grid-cols-3">
                  {[
                    ["Output", "2048 × 2048"],
                    ["Cost source", "Estimated"],
                    ["Storage", "Durable"],
                  ].map(([label, value]) => (
                    <div key={label} className="landing-border border-b py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0">
                      <p className="landing-faint font-sans text-[9px] uppercase tracking-[0.12em]">{label}</p>
                      <p className="mt-2 font-sans text-[12px] font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-border grid border-b lg:grid-cols-[1.2fr_0.8fr]">
        <div className="landing-border border-b p-3 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="relative min-h-[560px] overflow-hidden bg-[#191915]">
            <Image
              src="/glass-panels-mountain-studio.png"
              alt="A cinematic mountain studio image stored in the Eikon gallery"
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover saturate-[0.78]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/15" />
            <div className="absolute inset-x-0 bottom-0 grid gap-5 p-6 text-white sm:grid-cols-[1fr_auto] sm:items-end sm:p-8">
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-white/55">Gallery / alpine-study</p>
                <p className="mt-3 max-w-[500px] font-display text-3xl leading-[0.9] tracking-[-0.04em] sm:text-4xl">
                  Everything worth keeping, ready for the next prompt.
                </p>
              </div>
              <span className="rounded-full border border-white/25 px-4 py-2 font-sans text-[9px] uppercase tracking-[0.12em] backdrop-blur-md">
                @reference ready
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-12 lg:py-20 xl:px-16">
          <p className="landing-eyebrow font-sans text-[10px] uppercase tracking-[0.16em]">Creator memory</p>
          <h2 className="mt-8 font-display text-[clamp(3rem,4vw,4.8rem)] font-medium leading-[0.83] tracking-[-0.05em]">
            History is more than a thumbnail grid.
          </h2>
          <p className="landing-copy mt-7 font-sans text-[14px] leading-7">
            Revisit the prompt, exact model version, provider options, timing, and
            cost. Rerun it, move it to a folder, or use the result as a reference.
          </p>
          <div className="mt-8 space-y-3">
            {["Unified image and video timeline", "Full request and error details", "Folders, favorites, reruns, and downloads"].map(
              (feature) => (
                <div key={feature} className="landing-muted flex items-center gap-3 font-sans text-[12px]">
                  <Check className="size-3.5" strokeWidth={1.6} />
                  {feature}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="about" className="landing-border border-b px-4 py-4 sm:px-6 sm:py-6">
        <div className="landing-soft landing-border grid overflow-hidden rounded-[30px] border lg:grid-cols-[0.74fr_1.26fr]">
          <div className="landing-border flex flex-col justify-between border-b px-6 py-14 sm:px-10 lg:min-h-[560px] lg:border-b-0 lg:border-r lg:p-14 xl:p-16">
            <div>
              <p className="landing-eyebrow font-sans text-[10px] uppercase tracking-[0.16em]">Open by design</p>
              <h2 className="mt-8 font-display text-[clamp(3rem,4.2vw,5rem)] font-medium leading-[0.83] tracking-[-0.055em]">
                Your keys.
                <br />
                One contract.
              </h2>
              <p className="landing-copy mt-7 max-w-[390px] font-sans text-[14px] leading-7">
                Eikon normalizes provider differences without hiding native
                capabilities. Self-host it, keep control of spend, and build on a
                stable generation API.
              </p>
            </div>
            <div className="mt-10 flex gap-5">
              <KeyRound className="landing-muted size-4" strokeWidth={1.5} />
              <Cloud className="landing-muted size-4" strokeWidth={1.5} />
            </div>
          </div>

          <div className="flex min-w-0 items-center p-4 sm:p-8 lg:p-12 xl:p-16">
            <div className="landing-panel landing-border min-w-0 w-full overflow-hidden rounded-[24px] border shadow-[0_22px_60px_rgba(0,0,0,0.07)]">
              <div className="landing-border flex items-center justify-between border-b px-5 py-4">
                <span className="landing-faint font-sans text-[9px] uppercase tracking-[0.18em]">POST /api/v1/generations</span>
                <span className="size-2 rounded-full bg-[#b39035] shadow-[0_0_0_4px_rgba(179,144,53,0.12)]" />
              </div>
              <pre className="landing-code max-w-full overflow-x-auto p-6 text-[11px] leading-7 sm:p-8 sm:text-xs"><code><span className="text-[#9c7a24]">const</span> job = <span className="text-[#9c7a24]">await</span> eikon.generations.create({"{"}
{"\n  "}model: <span className="landing-code-strong">&quot;image/gpt-image&quot;</span>,
{"\n  "}input: {"{"}
{"\n    "}prompt: <span className="landing-code-strong">&quot;Roman arcade, modern camera&quot;</span>,
{"\n    "}aspectRatio: <span className="landing-code-strong">&quot;landscape&quot;</span>
{"\n  "}{"}"},
{"\n  "}webhookUrl: <span className="landing-code-strong">&quot;https://example.com/eikon&quot;</span>
{"\n"}{"}"});</code></pre>
              <div className="landing-border flex flex-wrap gap-2 border-t px-5 py-4">
                {["Durable job ID", "Signed webhooks", "Typed SDKs"].map((item) => (
                  <span key={item} className="landing-soft rounded-full px-3 py-1.5 font-sans text-[9px] uppercase tracking-[0.1em]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-24 text-center sm:px-10 sm:py-36">
        <div className="hero-cta-glow absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-[900px]">
          <p className="landing-eyebrow font-sans text-[10px] uppercase tracking-[0.2em]">Bring your own keys</p>
          <h2 className="mt-8 font-display text-[clamp(3.25rem,5vw,5.5rem)] font-medium leading-[0.82] tracking-[-0.055em]">
            Make across models. Keep it all yours.
          </h2>
          <p className="landing-copy mx-auto mt-8 max-w-[560px] font-sans text-[15px] leading-7">
            One open platform for creators, developers, images, and video.
          </p>
          <Link
            href="/studio/create"
            className="ui-pressable landing-inverse group mt-10 inline-flex h-12 items-center gap-8 rounded-full px-7 font-sans text-[13px] font-semibold hover:opacity-80"
          >
            Launch Eikon
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.5} />
          </Link>
        </div>
      </section>
    </>
  );
}
