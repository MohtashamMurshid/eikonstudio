const steps = [
  [
    "01",
    "Connect",
    "Add your own provider keys once. They're encrypted at rest and never returned to the client.",
  ],
  [
    "02",
    "Generate",
    "Work across ten model families in one hybrid playground — common fields, advanced schema, or raw JSON.",
  ],
  [
    "03",
    "Compare",
    "Run a shared prompt across up to four ready variants and see cost, latency, and output side by side.",
  ],
  [
    "04",
    "Ship",
    "Every job lands in a durable gallery and history, reachable from the same API your product calls.",
  ],
];

export function Stats() {
  return (
    <section id="process" className="border-b border-foreground/10">
      <div className="border-b border-foreground/10 px-6 py-8 sm:px-10">
        <p className="font-script text-xl text-emerald-500 sm:text-2xl">
          How Eikon works
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([number, title, copy]) => (
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
