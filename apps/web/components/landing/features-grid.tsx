import {
  Blocks,
  Braces,
  Gauge,
  GitCompare,
  LibraryBig,
  ShieldCheck,
} from "lucide-react";

const capabilities = [
  {
    icon: LibraryBig,
    title: "Public model catalog",
    copy: "Every active image and video variant across OpenAI, Google, BFL, BytePlus, Kling, and xAI — with readiness, capability, and pricing side by side.",
  },
  {
    icon: Blocks,
    title: "Hybrid playground",
    copy: "Common controls for quick work, advanced schema fields for control, and raw JSON when you need the full provider contract.",
  },
  {
    icon: GitCompare,
    title: "Sandbox comparisons",
    copy: "Run one prompt across up to four ready models and compare cost, latency, and output without losing a result to a failed run.",
  },
  {
    icon: ShieldCheck,
    title: "Durable async jobs",
    copy: "queued → processing → persisting → completed. Every input and output is copied to storage before a job is marked done.",
  },
  {
    icon: Gauge,
    title: "Usage & cost analytics",
    copy: "Reported, synced, or estimated cost on every request, grouped by provider, model, family, and status.",
  },
  {
    icon: Braces,
    title: "One API, two SDKs",
    copy: "A documented REST contract plus TypeScript and Python SDKs, so your product runs the same engine as the studio.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="capabilities" className="border-b border-foreground/10">
      <div className="grid lg:grid-cols-[0.64fr_1.36fr]">
        <div className="border-b border-foreground/10 px-6 py-14 sm:px-10 lg:border-b-0 lg:border-r lg:py-16">
          <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-500">
            Capabilities
          </p>
          <h2 className="mt-5 max-w-[330px] font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-5xl">
            A complete{" "}
            <span className="font-serif italic text-emerald-500">
              BYOK
            </span>{" "}
            workbench.
          </h2>
          <p className="mt-5 max-w-[320px] font-sans text-sm leading-6 text-foreground/50">
            Catalog, playground, sandbox, gallery, analytics, and API — one
            contract across six first-party providers.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="group min-h-[240px] border-b border-r border-foreground/10 p-7 transition-colors duration-200 hover:bg-foreground/[0.02] sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center text-emerald-500">
                    <Icon className="size-4" strokeWidth={1.4} />
                  </div>
                  <span className="font-script text-lg text-foreground/25">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 font-sans text-lg font-medium tracking-[-0.03em]">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-[300px] text-[12px] leading-[1.7] text-foreground/48">
                  {item.copy}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
