const providers = [
  { name: "OpenAI", detail: "GPT Image · Sora" },
  { name: "Google", detail: "Nano Banana · Veo · Gemini Omni" },
  { name: "Black Forest Labs", detail: "FLUX" },
  { name: "BytePlus ModelArk", detail: "Seedream · Seedance" },
  { name: "Kling AI", detail: "Kling" },
  { name: "xAI", detail: "Grok Imagine" },
];

export function ProvidersStrip() {
  return (
    <section id="providers" className="border-b border-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-foreground/10 px-6 py-5 sm:px-10">
        <p className="font-script text-xl text-emerald-500 sm:text-2xl">
          One contract, six first-party providers
        </p>
        <p className="max-w-[300px] text-[11px] leading-5 text-foreground/45">
          Each model family routes to its canonical vendor — no aggregation, no
          proxy markup.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className="group border-b border-r border-foreground/10 px-5 py-6 transition-colors duration-200 last:border-r-0 hover:bg-foreground/[0.02] lg:border-b-0"
          >
            <p className="text-[13px] font-medium tracking-[-0.01em]">
              {provider.name}
            </p>
            <p className="mt-1.5 text-[10px] leading-4 text-foreground/40">
              {provider.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
