import { Code2, Palette } from "lucide-react";

const useCases = [
  {
    icon: Palette,
    role: "Creator",
    headline: "Explore, generate, and keep what works.",
    copy: "Browse the catalog visually, run the playground, compare results in the sandbox, and build a durable gallery — without learning six vendor APIs.",
    items: [
      "Model catalog & favorites",
      "Playground and sandbox",
      "Generation history & gallery",
      "Personal usage summary",
    ],
  },
  {
    icon: Code2,
    role: "Developer",
    headline: "One contract, transparent everywhere.",
    copy: "A consistent API across providers, typed schemas, copyable request examples, and logs — the same engine your product ships against.",
    items: [
      "API activity & error rate",
      "Request logs & code examples",
      "Provider credential health",
      "Usage & cost breakdown",
    ],
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="border-b border-foreground/10">
      <div className="border-b border-foreground/10 px-6 py-14 sm:px-10 lg:py-16">
        <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-500">
          Use cases
        </p>
        <h2 className="mt-5 max-w-[420px] font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-5xl">
          Built for{" "}
          <span className="font-script text-emerald-500">creators</span> and{" "}
          <span className="font-serif italic">developers</span>.
        </h2>
        <p className="mt-5 max-w-[420px] font-sans text-sm leading-6 text-foreground/50">
          One account, one model registry, one set of jobs and media — just
          two views organized around how you work.
        </p>
      </div>

      <div className="grid lg:grid-cols-2">
        {useCases.map((useCase, index) => {
          const Icon = useCase.icon;
          return (
            <div
              key={useCase.role}
              className={`p-7 sm:p-10 lg:p-12 ${
                index === 0 ? "border-b border-foreground/10 lg:border-b-0 lg:border-r" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center border border-foreground/10 text-emerald-500">
                  <Icon className="size-4" strokeWidth={1.4} />
                </div>
                <span className="text-[9px] uppercase tracking-[0.18em] text-foreground/45">
                  {useCase.role}
                </span>
              </div>
              <h3 className="mt-8 max-w-[340px] font-sans text-2xl font-medium leading-[1.1] tracking-[-0.03em]">
                {useCase.headline}
              </h3>
              <p className="mt-4 max-w-[380px] text-[13px] leading-[1.7] text-foreground/50">
                {useCase.copy}
              </p>
              <ul className="mt-7 space-y-2.5">
                {useCase.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-[12px] text-foreground/55"
                  >
                    <span className="size-1 shrink-0 bg-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
