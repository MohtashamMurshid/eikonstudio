import { Braces, Film, FolderOpen, WandSparkles } from "lucide-react";

const capabilities = [
  {
    icon: WandSparkles,
    title: "Generate with range",
    copy: "Move between Gemini and GPT Image, art directions, skills, and up to 4K output.",
  },
  {
    icon: FolderOpen,
    title: "Keep your visual memory",
    copy: "Organize useful results, then bring past work back into new prompts with @mentions.",
  },
  {
    icon: Film,
    title: "Move beyond the still",
    copy: "Turn prompts and images into cinematic sequences with Veo-powered generation.",
  },
  {
    icon: Braces,
    title: "Wire it into your tools",
    copy: "Call the same generation engine through a documented REST API and playground.",
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
            A complete visual workbench.
          </h2>
          <p className="mt-5 max-w-[320px] font-sans text-sm leading-6 text-foreground/50">
            Generation, library, video, and API — connected so useful work never
            gets lost.
          </p>
        </div>

        <div className="grid sm:grid-cols-2">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="group min-h-[240px] border-b border-r border-foreground/10 p-7 transition-colors duration-200 hover:bg-foreground/[0.02] sm:p-8"
              >
                <div className="flex size-9 items-center justify-center text-emerald-500">
                  <Icon className="size-4" strokeWidth={1.4} />
                </div>
                <h3 className="mt-10 font-sans text-xl font-medium tracking-[-0.035em]">
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
