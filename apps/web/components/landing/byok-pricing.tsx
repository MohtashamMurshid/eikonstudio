import { Ban, KeyRound, ReceiptText } from "lucide-react";

const pillars = [
  {
    icon: KeyRound,
    title: "You hold the keys",
    copy: "Provider credentials are entered over TLS, encrypted at rest, and never returned to the client after saving.",
  },
  {
    icon: Ban,
    title: "Zero markup",
    copy: "Eikon doesn't resell inference, manage credits, or add a fee on top of provider pricing. You pay providers directly.",
  },
  {
    icon: ReceiptText,
    title: "Transparent cost",
    copy: "Every job stores a reported, synced, or estimated cost with its source — providers remain the invoice of record.",
  },
];

export function ByokPricing() {
  return (
    <section id="pricing" className="border-b border-foreground/10">
      <div className="border-b border-foreground/10 px-6 py-14 text-center sm:px-10 lg:py-16">
        <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-500">
          Pricing
        </p>
        <h2 className="mx-auto mt-5 max-w-[520px] font-sans text-4xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-5xl">
          Bring your own key.{" "}
          <span className="font-script text-emerald-500">
            Pay providers, not us.
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-[440px] font-sans text-sm leading-6 text-foreground/50">
          Eikon is free and open source. There are no Eikon credits, seats,
          or subscriptions — only the cost of the providers you connect.
        </p>
      </div>
      <div className="grid sm:grid-cols-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article
              key={pillar.title}
              className="group border-r border-foreground/10 p-8 text-center transition-colors duration-200 last:border-r-0 hover:bg-foreground/[0.02] sm:p-10"
            >
              <div className="mx-auto flex size-9 items-center justify-center text-emerald-500">
                <Icon className="size-4" strokeWidth={1.4} />
              </div>
              <h3 className="mt-6 font-sans text-lg font-medium tracking-[-0.03em]">
                {pillar.title}
              </h3>
              <p className="mx-auto mt-3 max-w-[240px] text-[12px] leading-[1.7] text-foreground/48">
                {pillar.copy}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
