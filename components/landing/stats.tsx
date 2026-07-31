const stats = [
  ["01", "Prompt", "Describe the frame, mood, light, and intent."],
  ["02", "Direct", "Choose a model, ratio, resolution, and visual skill."],
  ["03", "Refine", "Edit with references and preserve what already works."],
  ["04", "Ship", "Export the result or connect through the API."],
];

export function Stats() {
  return (
    <section id="process" className="border-b border-foreground/10">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([number, title, copy]) => (
          <article
            key={number}
            className="group border-b border-r border-foreground/10 p-7 transition-colors duration-200 last:border-r-0 hover:bg-foreground/[0.02] sm:p-8 lg:border-b-0"
          >
            <span className="text-[8px] tracking-[0.16em] text-emerald-500">
              {number}
            </span>
            <h2 className="mt-8 font-sans text-xl font-medium tracking-[-0.04em]">
              {title}
            </h2>
            <p className="mt-2 max-w-[230px] text-[11px] leading-[1.7] text-foreground/48">
              {copy}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
