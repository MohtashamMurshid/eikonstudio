const stats = [
  ["01", "Prompt", "Describe the frame, mood, light, and intent."],
  ["02", "Direct", "Choose a model, ratio, resolution, and visual skill."],
  ["03", "Refine", "Edit with references and preserve what already works."],
  ["04", "Ship", "Export the result or connect through the API."],
];

export function Stats() {
  return (
    <section id="process" className="border-b border-foreground/15">
      <div className="flex items-center justify-between border-b border-foreground/15 px-6 py-4 sm:px-10">
        <p className="text-[8px] uppercase tracking-[0.18em] text-foreground/42">
          Build sequence
        </p>
        <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-500">
          From idea to artifact
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([number, title, copy]) => (
          <article
            key={number}
            className="group border-b border-r border-foreground/15 p-6 transition-colors duration-200 hover:bg-foreground/[0.025] sm:p-7 lg:border-b-0"
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] tracking-[0.16em] text-emerald-500">
                {number}
              </span>
              <span className="h-px w-6 bg-foreground/15 transition-[width] duration-200 group-hover:w-10" />
            </div>
            <h2 className="mt-10 font-sans text-xl font-medium tracking-[-0.04em]">
              {title}
            </h2>
            <p className="mt-2 max-w-[230px] text-[10px] leading-[1.7] text-foreground/46">
              {copy}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
