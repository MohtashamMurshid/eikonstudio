import { Braces, Film, FolderOpen, WandSparkles } from "lucide-react";

const capabilities = [
  {
    icon: WandSparkles,
    code: "GEN.01",
    title: "Generate with range",
    copy: "Move between Gemini and GPT Image, 17 art directions, 13 skills, and up to 4K output.",
    status: "02 models",
  },
  {
    icon: FolderOpen,
    code: "LIB.02",
    title: "Keep your visual memory",
    copy: "Organize every useful result, then bring past work back into new prompts with @mentions.",
    status: "Synced",
  },
  {
    icon: Film,
    code: "MOV.03",
    title: "Move beyond the still",
    copy: "Turn prompts and images into cinematic sequences with Veo-powered generation.",
    status: "Veo 3.1",
  },
  {
    icon: Braces,
    code: "API.04",
    title: "Wire it into your tools",
    copy: "Call the same generation engine through a documented REST API and a focused playground.",
    status: "REST",
  },
];

export function FeaturesGrid() {
  return (
    <section id="capabilities" className="border-b border-foreground/15">
      <div className="grid lg:grid-cols-[0.64fr_1.36fr]">
        <div className="border-b border-foreground/15 px-6 py-12 sm:px-10 lg:border-b-0 lg:border-r lg:py-16">
          <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-500">
            Capabilities
          </p>
          <h2 className="mt-6 max-w-[330px] font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-5xl">
            A complete visual workbench.
          </h2>
          <p className="mt-6 max-w-[340px] font-sans text-sm leading-6 text-foreground/50">
            Each tool is deliberately connected, so the useful image never
            gets lost between generation and delivery.
          </p>
        </div>

        <div className="grid sm:grid-cols-2">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.code}
                className="group min-h-[280px] border-b border-r border-foreground/15 p-6 transition-colors duration-200 hover:bg-foreground/[0.025] sm:p-8"
              >
                <div className="flex items-start justify-between">
                  <div className="flex size-9 items-center justify-center border border-foreground/15 text-emerald-500">
                    <Icon className="size-4" strokeWidth={1.4} />
                  </div>
                  <span className="text-[7px] uppercase tracking-[0.16em] text-foreground/35">
                    {item.code}
                  </span>
                </div>
                <h3 className="mt-12 font-sans text-xl font-medium tracking-[-0.035em]">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-[310px] text-[10px] leading-[1.75] text-foreground/47">
                  {item.copy}
                </p>
                <div className="mt-7 flex items-center gap-2 text-[7px] uppercase tracking-[0.15em] text-foreground/35">
                  <span className="size-1.5 bg-emerald-500" />
                  {item.status}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
