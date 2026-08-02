import { MODEL_CATALOG, MODEL_CATALOG_CHECKED_AT } from "@eikonstudio/core";
import type { Metadata } from "next";

import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { ModelCatalog } from "@/components/models/model-catalog";

export const metadata: Metadata = {
  title: "Model Catalog · Eikon",
  description: "A source-backed catalog of image and video model variants tracked by Eikon, including provider lifecycle and Eikon execution readiness.",
};

export default function ModelsPage() {
  const readyCount = MODEL_CATALOG.filter((model) => model.readiness === "ready").length;
  const providerCount = new Set(MODEL_CATALOG.map((model) => model.providerId)).size;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main>
        <section className="relative overflow-hidden border-b border-foreground/10">
          <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="relative mx-auto grid max-w-[1500px] lg:grid-cols-[1.7fr_1fr]">
            <div className="px-5 py-16 sm:px-8 sm:py-24 lg:border-r lg:border-foreground/10 lg:px-12 lg:py-28">
              <p className="mb-6 text-[9px] uppercase tracking-[0.22em] text-foreground/45">Registry / {MODEL_CATALOG_CHECKED_AT}</p>
              <h1 className="max-w-4xl text-5xl font-medium tracking-[-0.065em] sm:text-7xl lg:text-[92px] lg:leading-[0.9]">The generative media landscape, mapped.</h1>
              <p className="mt-8 max-w-2xl text-sm leading-7 text-foreground/55 sm:text-base">
                First-party model IDs, lifecycle evidence, availability constraints, and Eikon integration status—kept deliberately separate. Provider availability does not mean a model is executable in Eikon.
              </p>
            </div>
            <div className="grid grid-cols-3 border-t border-foreground/10 lg:grid-cols-1 lg:border-t-0">
              {[
                [MODEL_CATALOG.length, "Verified variants"],
                [providerCount, "Providers"],
                [readyCount, "Eikon ready"],
              ].map(([value, label]) => (
                <div key={label} className="flex min-h-28 flex-col justify-between border-r border-foreground/10 p-4 last:border-r-0 lg:min-h-0 lg:border-b lg:border-r-0 lg:p-7 lg:last:border-b-0">
                  <span className="text-2xl tracking-[-0.04em] sm:text-3xl">{value}</span>
                  <span className="text-[8px] uppercase tracking-[0.16em] text-foreground/40">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <ModelCatalog models={MODEL_CATALOG} />
      </main>
      <LandingFooter />
    </div>
  );
}
