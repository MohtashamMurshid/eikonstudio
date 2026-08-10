import { CircleCheck } from "lucide-react";

const providers = [
  { name: "OpenAI", detail: "GPT Image · Sora" },
  { name: "Google", detail: "Nano Banana · Veo" },
  { name: "Black Forest Labs", detail: "FLUX" },
  { name: "BytePlus", detail: "Seedream · Seedance" },
  { name: "Kling AI", detail: "Kling" },
  { name: "xAI", detail: "Grok Imagine" },
];

export function ProvidersStrip() {
  return (
    <section id="providers" className="px-2 py-20 sm:px-3 sm:py-28">
      <div className="mx-auto max-w-[1480px] rounded-2xl border border-black/[0.06] bg-card px-5 py-6 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.3)] dark:border-white/10 sm:px-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <CircleCheck className="size-3.5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-sans text-[13px] font-semibold tracking-[-0.02em]">Six providers. One quiet workflow.</p>
              <p className="mt-0.5 font-sans text-[10px] text-foreground/40">Direct routes, zero proxy markup.</p>
            </div>
          </div>

          <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
            {providers.map((provider) => (
              <div key={provider.name} className="shrink-0 rounded-xl border border-foreground/[0.07] bg-muted/60 px-3.5 py-2.5">
                <p className="font-sans text-[10px] font-semibold text-foreground/75">{provider.name}</p>
                <p className="mt-0.5 font-sans text-[8px] text-foreground/35">{provider.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
