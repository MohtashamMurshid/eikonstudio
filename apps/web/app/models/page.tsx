import { MODEL_CATALOG, MODEL_CATALOG_CHECKED_AT } from "@eikonstudio/core";
import type { Metadata } from "next";

import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { ModelCatalog } from "@/components/models/model-catalog";

export const metadata: Metadata = {
  title: "Models · Eikon",
  description: "A source-backed catalog of image and video model variants tracked by Eikon, including provider lifecycle and Eikon execution readiness.",
};

export default function ModelsPage() {
  const readyCount = MODEL_CATALOG.filter((model) => model.readiness === "ready").length;
  const providerCount = new Set(MODEL_CATALOG.map((model) => model.providerId)).size;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <LandingHeader />
      <main className="pt-28 sm:pt-32">
        <header className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 pb-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:pb-10">
          <div>
            <h1 className="text-[28px] font-medium tracking-[-0.03em] sm:text-[32px]">Models</h1>
            <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-foreground/50">
              Source-backed image and video variants. Provider availability is not the same as Eikon execution.
            </p>
          </div>
          <p className="text-[12px] text-foreground/40">
            {MODEL_CATALOG.length} models · {providerCount} providers · {readyCount} ready · checked {MODEL_CATALOG_CHECKED_AT}
          </p>
        </header>
        <ModelCatalog models={MODEL_CATALOG} />
      </main>
      <LandingFooter />
    </div>
  );
}
